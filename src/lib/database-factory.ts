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

// Singleton instance to avoid recreating connections on every request
let dbInstance: TursoDatabase | null = null;
let cleanupRegistered = false;

/**
 * Factory function to create/get database instance.
 *
 * Uses Turso/libSQL as the database backend with singleton pattern.
 * This ensures we reuse the same connection and sync interval across requests.
 *
 * Configuration via environment variables:
 * - TURSO_DATABASE_URL - file:modeler.db or https://...
 * - TURSO_AUTH_TOKEN - Auth token for remote/replica
 * - TURSO_SYNC_URL - Sync URL for embedded replica
 */
export function createDatabase(): DatabaseInterface {
  if (!dbInstance) {
    dbInstance = new TursoDatabase();

    // Register cleanup handlers only once
    if (!cleanupRegistered) {
      cleanupRegistered = true;

      // Only cleanup on actual process exit, not dev server restart
      process.on('SIGINT', () => {
        if (dbInstance) {
          console.log('Closing database connection...');
          dbInstance.close();
          dbInstance = null;
        }
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        if (dbInstance) {
          dbInstance.close();
          dbInstance = null;
        }
        process.exit(0);
      });
    }
  }

  return dbInstance;
}
