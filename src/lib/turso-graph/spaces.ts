import { Client } from "@libsql/client";
import { CognitiveSpace } from "./types";

export class SpaceOperations {
  constructor(private client: Client) {}

  async insertSpace(space: CognitiveSpace): Promise<void> {
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

    // Delete existing edges for this space (for clean upsert)
    statements.push({
      sql: 'DELETE FROM edges WHERE space_id = ?',
      args: [space.metadata.id]
    });

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

      // Insert edges for this node (if relationships exist)
      if (nodeData.relationships && Array.isArray(nodeData.relationships)) {
        for (const rel of nodeData.relationships) {
          const edgeId = `${space.metadata.id}:${nodeKey}:${rel.target}`;
          statements.push({
            sql: `
              INSERT INTO edges (id, space_id, source_node, target_node, type, strength, gloss, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              edgeId,
              space.metadata.id,
              nodeKey,
              rel.target,
              rel.type,
              rel.strength,
              rel.gloss || null,
              now,
              now
            ]
          });
        }
      }
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
  }

  async getSpace(id: string): Promise<CognitiveSpace | null> {
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

    // Fetch all edges for this space and attach to nodes
    const edgesResult = await this.client.execute({
      sql: "SELECT source_node, target_node, type, strength, gloss FROM edges WHERE space_id = ?",
      args: [id]
    });

    // Group edges by source node
    for (const row of edgesResult.rows) {
      const sourceNode = row.source_node as string;
      if (nodes[sourceNode]) {
        // Initialize relationships array if it doesn't exist
        if (!nodes[sourceNode].relationships) {
          nodes[sourceNode].relationships = [];
        }
        // Add edge to node's relationships
        nodes[sourceNode].relationships.push({
          type: row.type as string,
          target: row.target_node as string,
          strength: row.strength as number,
          gloss: row.gloss ? (row.gloss as string) : undefined
        });
      }
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
    const result = await this.client.execute({
      sql: "DELETE FROM spaces WHERE id = ?",
      args: [id]
    });

    return result.rowsAffected > 0;
  }

  /**
   * Update space metadata (title and/or description) without touching nodes.
   */
  async updateSpaceMetadata(
    spaceId: string,
    updates: { title?: string; description?: string }
  ): Promise<void> {
    const setClause: string[] = [];
    const args: any[] = [];

    if (updates.title !== undefined) {
      setClause.push('title = ?');
      args.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClause.push('description = ?');
      args.push(updates.description);
    }

    if (setClause.length === 0) return;

    setClause.push('updated_at = ?');
    args.push(Date.now());
    args.push(spaceId);

    await this.client.execute({
      sql: `UPDATE spaces SET ${setClause.join(', ')} WHERE id = ?`,
      args
    });
  }

  /**
   * Append a single entry to the global history without rewriting the entire space.
   */
  async appendGlobalHistory(spaceId: string, entry: string): Promise<void> {
    const now = Date.now();
    const historyId = `${spaceId}:${now}`;

    await this.client.execute({
      sql: `INSERT INTO history (id, space_id, entry, created_at) VALUES (?, ?, ?, ?)`,
      args: [historyId, spaceId, entry, now]
    });
  }
}
