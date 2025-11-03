import { Database } from './database';
import { TursoDatabase } from './turso-database';
import type { CognitiveSpace } from './database';

// Unified interface for both database implementations
export interface DatabaseInterface {
  insertSpace(space: CognitiveSpace): Promise<void>;
  getSpace(id: string): Promise<CognitiveSpace | null>;
  listSpaces(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    nodeCount: number;
  }>>;
  deleteSpace(id: string): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Factory function to create database instance based on environment configuration.
 *
 * Use DATABASE_TYPE env var to select:
 * - 'turso' - Use Turso/libSQL (local file or remote)
 * - 'postgres' - Use PostgreSQL (default)
 *
 * For Turso configuration:
 * - TURSO_DATABASE_URL - file:modeler.db or https://...
 * - TURSO_AUTH_TOKEN - Auth token for remote/replica
 * - TURSO_SYNC_URL - Sync URL for embedded replica
 */
export function createDatabase(): DatabaseInterface {
  const dbType = process.env.DATABASE_TYPE || 'postgres';

  if (dbType === 'turso') {
    return new TursoDatabase();
  } else {
    return new Database();
  }
}
