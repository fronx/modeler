import { createClient, Client } from "@libsql/client";
import type { CognitiveSpace } from './database';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface TursoDatabaseConfig {
  url?: string;              // file:local.db or https://...
  authToken?: string;        // For remote/replica
  syncUrl?: string;          // For embedded replica
}

export class TursoDatabase {
  private client: Client;
  private initialized = false;

  constructor(config: TursoDatabaseConfig = {}) {
    this.client = createClient({
      url: config.url || process.env.TURSO_DATABASE_URL || "file:modeler.db",
      authToken: config.authToken || process.env.TURSO_AUTH_TOKEN,
      syncUrl: config.syncUrl || process.env.TURSO_SYNC_URL
    });
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

  async close(): Promise<void> {
    this.client.close();
  }
}
