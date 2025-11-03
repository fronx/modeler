import { TursoDatabase } from './turso-database';
import type { CognitiveSpace } from './turso-database';

// Database interface for Turso operations
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
 * Factory function to create database instance.
 *
 * Uses Turso/libSQL as the database backend.
 *
 * Configuration via environment variables:
 * - TURSO_DATABASE_URL - file:modeler.db or https://...
 * - TURSO_AUTH_TOKEN - Auth token for remote/replica
 * - TURSO_SYNC_URL - Sync URL for embedded replica
 */
export function createDatabase(): DatabaseInterface {
  return new TursoDatabase();
}
