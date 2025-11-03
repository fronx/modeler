import { createClient, Client } from "@libsql/client";
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  extractNodeSemantics,
  serializeEmbedding
} from './embeddings';

export interface CognitiveSpace {
  metadata: {
    id: string;
    title: string;
    description: string;
    createdAt: number;
  };
  nodes: Record<string, any>;
  globalHistory: string[];
}

export interface TursoDatabaseConfig {
  url?: string;              // file:local.db or https://...
  authToken?: string;        // For remote/replica
  syncUrl?: string;          // For embedded replica
  enableVectorSearch?: boolean;  // Whether to generate embeddings (requires OPENAI_API_KEY)
}

export interface SpaceSearchResult {
  id: string;
  title: string;
  description: string;
  similarity: number;  // 0-1, higher is more similar
  distance: number;    // Raw cosine distance (0-2)
}

export interface NodeSearchResult {
  nodeKey: string;
  spaceId: string;
  content: string;
  similarity: number;
  distance: number;
}

export class TursoDatabase {
  private client: Client;
  private initialized = false;
  private vectorSearchEnabled: boolean;

  constructor(config: TursoDatabaseConfig = {}) {
    this.client = createClient({
      url: config.url || process.env.TURSO_DATABASE_URL || "file:modeler.db",
      authToken: config.authToken || process.env.TURSO_AUTH_TOKEN,
      syncUrl: config.syncUrl || process.env.TURSO_SYNC_URL
    });
    this.vectorSearchEnabled = config.enableVectorSearch ?? (process.env.ENABLE_VECTOR_SEARCH === 'true');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Read and execute schema initialization
    const schemaPath = join(process.cwd(), 'scripts', 'init-turso-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Remove all comment lines and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))  // Remove comment-only lines
      .join('\n');

    // Split by semicolons and execute each statement
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await this.client.execute(statement);
    }

    this.initialized = true;
  }

  async insertSpace(space: CognitiveSpace): Promise<void> {
    await this.ensureInitialized();

    const now = Date.now();

    // Use batch for transactional insert across tables
    const statements = [
      // Upsert space metadata
      {
        sql: `
          INSERT INTO spaces (id, title, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            updated_at = excluded.updated_at
        `,
        args: [
          space.metadata.id,
          space.metadata.title,
          space.metadata.description,
          space.metadata.createdAt,
          now
        ]
      },
      // Delete existing nodes for this space (for clean upsert)
      {
        sql: 'DELETE FROM nodes WHERE space_id = ?',
        args: [space.metadata.id]
      },
      // Delete existing history for this space
      {
        sql: 'DELETE FROM history WHERE space_id = ?',
        args: [space.metadata.id]
      }
    ];

    // Insert all nodes
    for (const [nodeKey, nodeData] of Object.entries(space.nodes)) {
      statements.push({
        sql: `
          INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          `${space.metadata.id}:${nodeKey}`,  // Composite ID
          space.metadata.id,
          nodeKey,
          JSON.stringify(nodeData),
          now,
          now
        ]
      });
    }

    // Insert all history entries
    for (let i = 0; i < space.globalHistory.length; i++) {
      const entry = space.globalHistory[i];
      statements.push({
        sql: `
          INSERT INTO history (id, space_id, entry, created_at)
          VALUES (?, ?, ?, ?)
        `,
        args: [
          `${space.metadata.id}:${i}:${now}`,  // Unique ID with index
          space.metadata.id,
          entry,
          now
        ]
      });
    }

    await this.client.batch(statements, 'write');

    // Generate embeddings if enabled (Phase 2: Vector Search)
    if (this.vectorSearchEnabled) {
      try {
        // Generate space embeddings
        const [titleEmb, descEmb] = await generateEmbeddingsBatch([
          space.metadata.title,
          space.metadata.description || space.metadata.title
        ]);
        await this.updateSpaceEmbeddings(space.metadata.id, titleEmb, descEmb);

        // Generate node embeddings in batches
        const nodeEntries = Object.entries(space.nodes);
        if (nodeEntries.length > 0) {
          const nodeTexts: string[] = [];
          const nodeKeys: string[] = [];

          for (const [nodeKey, nodeData] of nodeEntries) {
            const { title, fullContent } = extractNodeSemantics(nodeData);
            nodeTexts.push(title, fullContent);
            nodeKeys.push(nodeKey);
          }

          const embeddings = await generateEmbeddingsBatch(nodeTexts);

          // Update each node with its embeddings (title and full)
          for (let i = 0; i < nodeKeys.length; i++) {
            const titleEmb = embeddings[i * 2];
            const fullEmb = embeddings[i * 2 + 1];
            await this.updateNodeEmbeddings(space.metadata.id, nodeKeys[i], titleEmb, fullEmb);
          }
        }
      } catch (error) {
        console.error('Failed to generate embeddings for space:', space.metadata.id, error);
        // Don't fail the entire operation if embedding generation fails
      }
    }
  }

  async getSpace(id: string): Promise<CognitiveSpace | null> {
    await this.ensureInitialized();

    // Fetch space metadata
    const spaceResult = await this.client.execute({
      sql: "SELECT * FROM spaces WHERE id = ?",
      args: [id]
    });

    if (spaceResult.rows.length === 0) return null;

    const spaceRow = spaceResult.rows[0];

    // Fetch all nodes for this space
    const nodesResult = await this.client.execute({
      sql: "SELECT node_key, data FROM nodes WHERE space_id = ? ORDER BY created_at",
      args: [id]
    });

    const nodes: Record<string, any> = {};
    for (const row of nodesResult.rows) {
      const nodeKey = row.node_key as string;
      const nodeData = JSON.parse(row.data as string);
      nodes[nodeKey] = nodeData;
    }

    // Fetch all history for this space
    const historyResult = await this.client.execute({
      sql: "SELECT entry FROM history WHERE space_id = ? ORDER BY created_at",
      args: [id]
    });

    const globalHistory = historyResult.rows.map(row => row.entry as string);

    return {
      metadata: {
        id: spaceRow.id as string,
        title: spaceRow.title as string,
        description: spaceRow.description as string,
        createdAt: spaceRow.created_at as number
      },
      nodes,
      globalHistory
    };
  }

  async listSpaces(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    nodeCount: number;
  }>> {
    await this.ensureInitialized();

    // Join with nodes table to count - much cleaner with relational design!
    const result = await this.client.execute(`
      SELECT
        s.id,
        s.title,
        s.description,
        s.created_at,
        s.updated_at,
        COUNT(n.id) as node_count
      FROM spaces s
      LEFT JOIN nodes n ON n.space_id = s.id
      GROUP BY s.id, s.title, s.description, s.created_at, s.updated_at
      ORDER BY s.updated_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      nodeCount: Number(row.node_count)
    }));
  }

  async deleteSpace(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.client.execute({
      sql: "DELETE FROM spaces WHERE id = ?",
      args: [id]
    });
    return result.rowsAffected > 0;
  }

  // ============================================================================
  // Vector Search Methods (Phase 2)
  // ============================================================================

  /**
   * Update embeddings for a space's title and description.
   * Called automatically during insertSpace if vectorSearchEnabled is true.
   */
  async updateSpaceEmbeddings(
    spaceId: string,
    titleEmbedding: Float32Array,
    descriptionEmbedding: Float32Array
  ): Promise<void> {
    await this.ensureInitialized();

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
   * Update embeddings for a node's title and full semantic content.
   * Called automatically during insertSpace if vectorSearchEnabled is true.
   */
  async updateNodeEmbeddings(
    spaceId: string,
    nodeKey: string,
    titleEmbedding: Float32Array,
    fullEmbedding: Float32Array
  ): Promise<void> {
    await this.ensureInitialized();

    await this.client.execute({
      sql: `
        UPDATE nodes
        SET title_embedding = vector32(?),
            full_embedding = vector32(?)
        WHERE space_id = ? AND node_key = ?
      `,
      args: [
        serializeEmbedding(titleEmbedding),
        serializeEmbedding(fullEmbedding),
        spaceId,
        nodeKey
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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

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

  async close(): Promise<void> {
    this.client.close();
  }
}
