import pg from 'pg';
const { Pool } = pg;

export interface CognitiveSpace {
  metadata: {
    id: string;
    title: string;
    description: string;
    createdAt: number;
  };
  thoughtSpace: {
    nodes: Record<string, any>;
    globalHistory: string[];
  };
}

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export class Database {
  private pool: any;

  constructor(config: DatabaseConfig = {}) {
    this.pool = new Pool({
      host: config.host || '127.0.0.1',
      port: config.port || 54322,
      database: config.database || 'postgres',
      user: config.user || 'postgres',
      password: config.password || 'postgres'
    });
  }

  async insertSpace(space: CognitiveSpace): Promise<void> {
    await this.pool.query(`
      INSERT INTO spaces (id, title, description, data, created_at, updated_at)
      VALUES ($1, $2, $3, $4, to_timestamp($5::bigint / 1000), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        data = EXCLUDED.data,
        updated_at = NOW()
    `, [
      space.metadata.id,
      space.metadata.title,
      space.metadata.description,
      JSON.stringify(space.thoughtSpace),
      space.metadata.createdAt
    ]);
  }

  async getSpace(id: string): Promise<CognitiveSpace | null> {
    const result = await this.pool.query(`
      SELECT id, title, description, data,
             EXTRACT(epoch FROM created_at) * 1000 as created_at
      FROM spaces WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      metadata: {
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: parseInt(row.created_at)
      },
      thoughtSpace: row.data
    };
  }

  async listSpaces(): Promise<Array<{id: string, title: string, description: string, createdAt: number, updatedAt: number, nodeCount: number}>> {
    const result = await this.pool.query(`
      SELECT id, title, description,
             EXTRACT(epoch FROM created_at) * 1000 as created_at,
             EXTRACT(epoch FROM updated_at) * 1000 as updated_at,
             CASE
               WHEN data->'nodes' IS NOT NULL
               THEN (SELECT COUNT(*) FROM jsonb_object_keys(data->'nodes'))
               ELSE 0
             END as node_count
      FROM spaces ORDER BY updated_at DESC
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      createdAt: parseInt(row.created_at),
      updatedAt: parseInt(row.updated_at),
      nodeCount: row.node_count
    }));
  }

  async deleteSpace(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM spaces WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}