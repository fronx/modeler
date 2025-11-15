import { Client } from "@libsql/client";
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  extractNodeSemantics,
  serializeEmbedding
} from '../embeddings';
import { SpaceSearchResult, NodeSearchResult } from "./types";

export class VectorSearch {
  constructor(
    private client: Client,
    private vectorSearchEnabled: boolean
  ) {}

  /**
   * Update embeddings for a space's title and description.
   * Called automatically during insertSpace if vectorSearchEnabled is true.
   */
  async updateSpaceEmbeddings(
    spaceId: string,
    titleEmbedding: Float32Array,
    descriptionEmbedding: Float32Array
  ): Promise<void> {
    await this.client.execute({
      sql: `
        UPDATE spaces
        SET title_embedding = vector32(?),
            description_embedding = vector32(?)
        WHERE id = ?
      `,
      args: [
        serializeEmbedding(titleEmbedding),
        serializeEmbedding(descriptionEmbedding),
        spaceId
      ]
    });
  }

  /**
   * Search for spaces by semantic similarity to a query.
   * Uses title embeddings for fast lookup.
   *
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @returns Array of spaces ordered by similarity (highest first)
   */
  async searchSpaces(query: string, limit: number = 10): Promise<SpaceSearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k to find nearest neighbors
    const result = await this.client.execute({
      sql: `
        SELECT
          s.id, s.title, s.description,
          vector_distance_cos(s.title_embedding, vector32(?)) as distance
        FROM vector_top_k('spaces_title_vec_idx', vector32(?), ?)
        INNER JOIN spaces s ON s.rowid = vector_top_k.rowid
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit]
    });

    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      distance: row.distance as number,
      similarity: 1 - (row.distance as number) / 2  // Convert cosine distance to similarity
    }));
  }

  /**
   * Search for nodes within a specific space by semantic similarity.
   * Uses full_embedding for rich semantic search including meanings, values, etc.
   *
   * @param spaceId - The space to search within
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @param threshold - Minimum similarity threshold (0-1)
   * @returns Array of nodes ordered by similarity (highest first)
   */
  async searchNodesInSpace(
    spaceId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.5
  ): Promise<NodeSearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k and filter by space_id
    // Note: We fetch more results (limit * 3) before filtering to account for space filtering
    const result = await this.client.execute({
      sql: `
        SELECT
          n.node_key, n.space_id, n.data,
          vector_distance_cos(n.full_embedding, vector32(?)) as distance
        FROM vector_top_k('nodes_full_embedding_idx', vector32(?), ?)
        INNER JOIN nodes n ON n.rowid = vector_top_k.rowid
        WHERE n.space_id = ?
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit * 3, spaceId]
    });

    // Filter by threshold and limit results
    const distanceThreshold = (1 - threshold) * 2;  // Convert similarity to distance

    return result.rows
      .filter(row => (row.distance as number) <= distanceThreshold)
      .slice(0, limit)
      .map(row => {
        const nodeData = JSON.parse(row.data as string);
        const { fullContent } = extractNodeSemantics(nodeData);

        return {
          nodeKey: row.node_key as string,
          spaceId: row.space_id as string,
          content: fullContent,
          distance: row.distance as number,
          similarity: 1 - (row.distance as number) / 2
        };
      });
  }

  /**
   * Search across all nodes in all spaces by semantic similarity.
   * Useful for finding related concepts across the entire cognitive model.
   *
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @param threshold - Minimum similarity threshold (0-1)
   * @returns Array of nodes ordered by similarity (highest first)
   */
  async searchAllNodes(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<NodeSearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k across all nodes
    const result = await this.client.execute({
      sql: `
        SELECT
          n.node_key, n.space_id, n.data,
          vector_distance_cos(n.full_embedding, vector32(?)) as distance
        FROM vector_top_k('nodes_full_embedding_idx', vector32(?), ?)
        INNER JOIN nodes n ON n.rowid = vector_top_k.rowid
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit * 2]
    });

    // Filter by threshold and limit results
    const distanceThreshold = (1 - threshold) * 2;  // Convert similarity to distance

    return result.rows
      .filter(row => (row.distance as number) <= distanceThreshold)
      .slice(0, limit)
      .map(row => {
        const nodeData = JSON.parse(row.data as string);
        const { fullContent } = extractNodeSemantics(nodeData);

        return {
          nodeKey: row.node_key as string,
          spaceId: row.space_id as string,
          content: fullContent,
          distance: row.distance as number,
          similarity: 1 - (row.distance as number) / 2
        };
      });
  }

  /**
   * Generate and update embeddings for a node
   */
  async updateNodeEmbeddings(
    spaceId: string,
    nodeKey: string,
    nodeData: any
  ): Promise<void> {
    if (!this.vectorSearchEnabled) return;

    const { title, fullContent } = extractNodeSemantics(nodeData);
    const [titleEmb, contentEmb] = await generateEmbeddingsBatch([title, fullContent]);
    const nodeId = `${spaceId}:${nodeKey}`;

    await this.client.execute({
      sql: `
        UPDATE nodes
        SET title_embedding = vector32(?),
            full_embedding = vector32(?)
        WHERE id = ?
      `,
      args: [
        serializeEmbedding(titleEmb),
        serializeEmbedding(contentEmb),
        nodeId
      ]
    });
  }

  /**
   * Generate and update embeddings for multiple nodes in batch
   */
  async updateNodesEmbeddingsBatch(
    spaceId: string,
    nodeEntries: Array<[string, any]>
  ): Promise<void> {
    if (!this.vectorSearchEnabled || nodeEntries.length === 0) return;

    const nodeTexts: string[] = [];
    const nodeKeys: string[] = [];

    for (const [nodeKey, nodeData] of nodeEntries) {
      const { title, fullContent } = extractNodeSemantics(nodeData);
      nodeTexts.push(title, fullContent);
      nodeKeys.push(nodeKey);
    }

    const embeddings = await generateEmbeddingsBatch(nodeTexts);

    // Batch update all node embeddings in a single transaction
    const nodeUpdateStatements = [];
    for (let i = 0; i < nodeKeys.length; i++) {
      const titleEmb = embeddings[i * 2];
      const fullEmb = embeddings[i * 2 + 1];
      nodeUpdateStatements.push({
        sql: `
          UPDATE nodes
          SET title_embedding = vector32(?),
              full_embedding = vector32(?)
          WHERE space_id = ? AND node_key = ?
        `,
        args: [
          serializeEmbedding(titleEmb),
          serializeEmbedding(fullEmb),
          spaceId,
          nodeKeys[i]
        ]
      });
    }
    await this.client.batch(nodeUpdateStatements, 'write');
  }

  /**
   * Generate and update embeddings for a space
   */
  async generateSpaceEmbeddings(
    spaceId: string,
    title: string,
    description: string
  ): Promise<void> {
    if (!this.vectorSearchEnabled) return;

    const [titleEmb, descEmb] = await generateEmbeddingsBatch([
      title,
      description || title
    ]);

    await this.updateSpaceEmbeddings(spaceId, titleEmb, descEmb);
  }
}
