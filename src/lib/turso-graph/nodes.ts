import { Client } from "@libsql/client";

export class NodeOperations {
  constructor(private client: Client) {}

  async deleteNode(spaceId: string, nodeKey: string): Promise<boolean> {
    const t0 = Date.now();
    const nodeId = `${spaceId}:${nodeKey}`;
    const t1 = Date.now();
    const result = await this.client.execute({
      sql: "DELETE FROM nodes WHERE id = ?",
      args: [nodeId]
    });
    const t2 = Date.now();
    console.log(`[DB] SQL DELETE took ${t2 - t1}ms`);

    return result.rowsAffected > 0;
  }

  /**
   * Insert or update a single node in a space.
   * Also handles upserting the node's edges.
   */
  async upsertNode(spaceId: string, nodeKey: string, nodeData: any): Promise<void> {
    const now = Date.now();
    const nodeId = `${spaceId}:${nodeKey}`;

    const statements = [
      // Upsert the node
      {
        sql: `
          INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `,
        args: [
          nodeId,
          spaceId,
          nodeKey,
          JSON.stringify(nodeData),
          now,
          now
        ]
      },
      // Delete existing edges for this node
      {
        sql: 'DELETE FROM edges WHERE space_id = ? AND source_node = ?',
        args: [spaceId, nodeKey]
      }
    ];

    // Insert edges for this node
    if (nodeData.relationships && Array.isArray(nodeData.relationships)) {
      for (const rel of nodeData.relationships) {
        const edgeId = `${spaceId}:${nodeKey}:${rel.target}`;
        statements.push({
          sql: `
            INSERT INTO edges (id, space_id, source_node, target_node, type, strength, gloss, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            edgeId,
            spaceId,
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

    await this.client.batch(statements, 'write');
  }

  /**
   * Update a specific field in a node's data without replacing the entire node.
   */
  async updateNodeField(
    spaceId: string,
    nodeKey: string,
    field: string,
    value: any
  ): Promise<void> {
    // First, fetch the current node data
    const nodeId = `${spaceId}:${nodeKey}`;
    const result = await this.client.execute({
      sql: 'SELECT data FROM nodes WHERE id = ?',
      args: [nodeId]
    });

    if (result.rows.length === 0) {
      throw new Error(`Node not found: ${nodeKey} in space ${spaceId}`);
    }

    const nodeData = JSON.parse(result.rows[0].data as string);
    nodeData[field] = value;

    // Update the node with the modified data
    const now = Date.now();
    await this.client.execute({
      sql: `UPDATE nodes SET data = ?, updated_at = ? WHERE id = ?`,
      args: [JSON.stringify(nodeData), now, nodeId]
    });
  }
}
