import { TursoDatabase } from './turso-database';
import type { CognitiveSpace, SpaceSearchResult, NodeSearchResult } from './turso-database';

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
  deleteNode(spaceId: string, nodeKey: string): Promise<boolean>;
  saveSession(session: {
    id: string;
    title?: string;
    spaceId?: string | null;
    messageCount: number;
  }): Promise<void>;
  touchSession(sessionId: string): Promise<void>;
  listSessions(): Promise<Array<{
    id: string;
    title: string | null;
    spaceId: string | null;
    messageCount: number;
    createdAt: number;
    lastUsedAt: number;
  }>>;
  searchSpaces?(query: string, limit?: number): Promise<SpaceSearchResult[]>;
  searchNodesInSpace?(spaceId: string, query: string, limit?: number, threshold?: number): Promise<NodeSearchResult[]>;
  searchAllNodes?(query: string, limit?: number, threshold?: number): Promise<NodeSearchResult[]>;
  updateNode?(spaceId: string, nodeKey: string, updates: any): Promise<void>;
  withSuspendedAutoSync<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Global singleton key - using Symbol.for ensures it's shared across all module instances
// This is critical for Next.js which may bundle this module multiple times
const GLOBAL_DB_KEY = Symbol.for('modeler.database.instance');
const GLOBAL_CLEANUP_KEY = Symbol.for('modeler.database.cleanup_registered');

// Type declarations for globalThis - we store using symbols for cross-bundle access
interface GlobalDatabaseRegistry {
  [key: symbol]: TursoDatabase | boolean | undefined;
}

/**
 * Factory function to create/get database instance.
 *
 * Uses Turso/libSQL as the database backend with TRUE singleton pattern.
 * Uses Symbol.for() to ensure the same instance is shared across all Next.js bundles.
 * This prevents multiple database clients from causing sync conflicts.
 *
 * Configuration via environment variables:
 * - TURSO_DATABASE_URL - file:modeler.db or https://...
 * - TURSO_AUTH_TOKEN - Auth token for remote/replica
 * - TURSO_SYNC_URL - Sync URL for embedded replica
 */
export function createDatabase(): DatabaseInterface {
  // Access global singleton using Symbol
  const globalAny = globalThis as any;

  if (!globalAny[GLOBAL_DB_KEY]) {
    console.log('[DB Factory] No global instance found, creating new TursoDatabase...');
    globalAny[GLOBAL_DB_KEY] = new TursoDatabase();

    // Register cleanup handlers only once globally
    if (!globalAny[GLOBAL_CLEANUP_KEY]) {
      globalAny[GLOBAL_CLEANUP_KEY] = true;
      console.log('[DB Factory] Registering global cleanup handlers');

      // Only cleanup on actual process exit, not dev server restart
      process.on('SIGINT', () => {
        const instance = globalAny[GLOBAL_DB_KEY];
        if (instance) {
          console.log('[DB Factory] Closing database connection on SIGINT...');
          instance.close();
          delete globalAny[GLOBAL_DB_KEY];
        }
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        const instance = globalAny[GLOBAL_DB_KEY];
        if (instance) {
          console.log('[DB Factory] Closing database connection on SIGTERM...');
          instance.close();
          delete globalAny[GLOBAL_DB_KEY];
        }
        process.exit(0);
      });
    }
  } else {
    console.log('[DB Factory] Reusing existing global database instance');
  }

  return globalAny[GLOBAL_DB_KEY];
}
