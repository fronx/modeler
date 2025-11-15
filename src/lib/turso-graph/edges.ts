import { Client } from "@libsql/client";

export class EdgeOperations {
  constructor(private client: Client) {}

  /**
   * Insert or update an edge between two nodes
   */
  async insertEdge(edge: {
    spaceId: string;
    sourceNode: string;
    targetNode: string;
    type: string;
    strength: number;
    gloss?: string;
  }): Promise<void> {
    const now = Date.now();
    const edgeId = `${edge.spaceId}:${edge.sourceNode}:${edge.targetNode}`;

    await this.client.execute({
      sql: `
        INSERT INTO edges (id, space_id, source_node, target_node, type, strength, gloss, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(space_id, source_node, target_node) DO UPDATE SET
          type = excluded.type,
          strength = excluded.strength,
          gloss = excluded.gloss,
          updated_at = excluded.updated_at
      `,
      args: [
        edgeId,
        edge.spaceId,
        edge.sourceNode,
        edge.targetNode,
        edge.type,
        edge.strength,
        edge.gloss || null,
        now,
        now
      ]
    });
  }

  /**
   * List all edges for a space
   */
  async listEdges(spaceId: string): Promise<Array<{
    id: string;
    sourceNode: string;
    targetNode: string;
    type: string;
    strength: number;
    gloss?: string;
  }>> {
    const result = await this.client.execute({
      sql: 'SELECT id, source_node, target_node, type, strength, gloss FROM edges WHERE space_id = ?',
      args: [spaceId]
    });

    return result.rows.map(row => ({
      id: row.id as string,
      sourceNode: row.source_node as string,
      targetNode: row.target_node as string,
      type: row.type as string,
      strength: row.strength as number,
      gloss: row.gloss ? (row.gloss as string) : undefined
    }));
  }

  /**
   * Delete an edge by ID
   */
  async deleteEdge(edgeId: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: 'DELETE FROM edges WHERE id = ?',
      args: [edgeId]
    });

    return result.rowsAffected > 0;
  }
}
