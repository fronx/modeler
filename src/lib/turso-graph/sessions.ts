import { Client } from "@libsql/client";

export class SessionOperations {
  constructor(private client: Client) {}

  /**
   * Save or update a Claude CLI session
   */
  async saveSession(session: {
    id: string;
    title?: string;
    spaceId?: string;
    messageCount: number;
  }): Promise<void> {
    const now = Date.now();

    await this.client.execute({
      sql: `
        INSERT INTO sessions (id, title, space_id, message_count, created_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          space_id = excluded.space_id,
          message_count = excluded.message_count,
          last_used_at = excluded.last_used_at
      `,
      args: [
        session.id,
        session.title || null,
        session.spaceId || null,
        session.messageCount,
        now,
        now
      ]
    });
  }

  /**
   * Update session last used timestamp and increment message count
   */
  async touchSession(sessionId: string): Promise<void> {
    await this.client.execute({
      sql: `
        UPDATE sessions
        SET last_used_at = ?,
            message_count = message_count + 1
        WHERE id = ?
      `,
      args: [Date.now(), sessionId]
    });
  }

  /**
   * List all sessions ordered by last used
   */
  async listSessions(): Promise<Array<{
    id: string;
    title: string | null;
    spaceId: string | null;
    messageCount: number;
    createdAt: number;
    lastUsedAt: number;
  }>> {
    const result = await this.client.execute(`
      SELECT id, title, space_id, message_count, created_at, last_used_at
      FROM sessions
      ORDER BY last_used_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string | null,
      spaceId: row.space_id as string | null,
      messageCount: row.message_count as number,
      createdAt: row.created_at as number,
      lastUsedAt: row.last_used_at as number
    }));
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: 'DELETE FROM sessions WHERE id = ?',
      args: [sessionId]
    });

    return result.rowsAffected > 0;
  }
}
