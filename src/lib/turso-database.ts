import { createClient, Client } from "@libsql/client";
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  extractNodeSemantics,
  serializeEmbedding
} from './embeddings';

export interface CognitiveSpace {
  metadata: {
    id: string;
    title: string;
    description: string;
    createdAt: number;
  };
  nodes: Record<string, any>;
  globalHistory: string[];
}

export interface TursoDatabaseConfig {
  url?: string;              // file:local.db or https://...
  authToken?: string;        // For remote/replica
  syncUrl?: string;          // For embedded replica
  syncInterval?: number;     // Auto-sync interval in seconds (0 = disabled)
  enableVectorSearch?: boolean;  // Whether to generate embeddings (requires OPENAI_API_KEY)
  offline?: boolean;         // Enable offline mode for fast local writes (default: true for embedded replicas)
                            // When true: writes are instant (1-2ms), synced in background
                            // When false: writes wait for remote confirmation (100-3000ms+ depending on network)
}

export interface SyncStats {
  lastSyncedAt?: number;     // Timestamp of last successful sync
  syncCount: number;         // Total number of syncs performed
  isSyncing: boolean;        // Whether a sync is currently in progress
  lastError?: string;        // Last sync error message
}

export interface SpaceSearchResult {
  id: string;
  title: string;
  description: string;
  similarity: number;  // 0-1, higher is more similar
  distance: number;    // Raw cosine distance (0-2)
}

export interface NodeSearchResult {
  nodeKey: string;
  spaceId: string;
  content: string;
  similarity: number;
  distance: number;
}

export class TursoDatabase {
  private client: Client;
  private initialized = false;
  private vectorSearchEnabled: boolean;
  private syncIntervalId?: NodeJS.Timeout;
  private syncStats: SyncStats = {
    syncCount: 0,
    isSyncing: false
  };
  private isEmbeddedReplica: boolean;

  constructor(config: TursoDatabaseConfig = {}) {
    const url = config.url || process.env.TURSO_DATABASE_URL || "file:modeler.db";
    const syncUrl = config.syncUrl || process.env.TURSO_SYNC_URL;
    const syncInterval = config.syncInterval ?? (process.env.TURSO_SYNC_INTERVAL ? parseInt(process.env.TURSO_SYNC_INTERVAL) : 0);

    this.isEmbeddedReplica = !!syncUrl && url.startsWith('file:');

    try {
      // IMPORTANT: Enable offline mode for embedded replicas to get fast local writes.
      // Without this, every write operation blocks waiting for network round-trip to remote Turso.
      // Performance impact: offline:false = 3000ms+, offline:true = 1-2ms for typical writes.
      // Trade-off: With offline:true, other replicas see changes after next sync interval (not immediately).
      const useOfflineMode = config.offline ?? this.isEmbeddedReplica;

      this.client = createClient({
        url,
        authToken: config.authToken || process.env.TURSO_AUTH_TOKEN,
        syncUrl,
        offline: useOfflineMode
      });
    } catch (error) {
      // Check for the specific "db file exists but metadata file does not" error
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('db file exists but metadata file does not')) {
        const dbPath = url.replace('file:', '');
        throw new Error(
          `Invalid local state: Database file exists without sync metadata.\n\n` +
          `This happens when you enable embedded replicas on an existing database.\n\n` +
          `To fix this:\n` +
          `1. Back up your current database:\n` +
          `   mv ${dbPath} ${dbPath}.backup\n\n` +
          `2. Restart your application - it will create a fresh replica and sync from remote\n\n` +
          `If you haven't migrated your data yet:\n` +
          `1. First migrate: npx tsx scripts/migrate-to-embedded-replica.ts\n` +
          `2. Then back up and remove: mv ${dbPath} ${dbPath}.backup\n` +
          `3. Restart your application\n\n` +
          `See docs/EMBEDDED-REPLICAS.md for more details.`
        );
      }
      // Re-throw other errors
      throw error;
    }

    this.vectorSearchEnabled = config.enableVectorSearch ?? (process.env.ENABLE_VECTOR_SEARCH === 'true');

    // Set up automatic syncing if interval is specified and we're using embedded replica
    if (this.isEmbeddedReplica && syncInterval > 0) {
      this.startAutoSync(syncInterval);
    }
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

    // Generate embeddings if enabled (Phase 2: Vector Search)
    if (this.vectorSearchEnabled) {
      try {
        // Generate space embeddings
        const [titleEmb, descEmb] = await generateEmbeddingsBatch([
          space.metadata.title,
          space.metadata.description || space.metadata.title
        ]);

        await this.updateSpaceEmbeddings(space.metadata.id, titleEmb, descEmb);

        // Generate node embeddings in batches
        const nodeEntries = Object.entries(space.nodes);
        if (nodeEntries.length > 0) {
          const nodeTexts: string[] = [];
          const nodeKeys: string[] = [];

          for (const [nodeKey, nodeData] of nodeEntries) {
            const { title, fullContent } = extractNodeSemantics(nodeData);
            nodeTexts.push(title, fullContent);
            nodeKeys.push(nodeKey);
          }

          const embeddings = await generateEmbeddingsBatch(nodeTexts);

          // Batch update all node embeddings in a single transaction
          const nodeUpdateStatements = [];
          for (let i = 0; i < nodeKeys.length; i++) {
            const titleEmb = embeddings[i * 2];
            const fullEmb = embeddings[i * 2 + 1];
            nodeUpdateStatements.push({
              sql: `
                UPDATE nodes
                SET title_embedding = vector32(?),
                    full_embedding = vector32(?)
                WHERE space_id = ? AND node_key = ?
              `,
              args: [
                serializeEmbedding(titleEmb),
                serializeEmbedding(fullEmb),
                space.metadata.id,
                nodeKeys[i]
              ]
            });
          }
          await this.client.batch(nodeUpdateStatements, 'write');
        }
      } catch (error) {
        console.error('Failed to generate embeddings for space:', space.metadata.id, error);
        // Don't fail the entire operation if embedding generation fails
      }
    }
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

  // ============================================================================
  // Vector Search Methods (Phase 2)
  // ============================================================================

  /**
   * Update embeddings for a space's title and description.
   * Called automatically during insertSpace if vectorSearchEnabled is true.
   */
  async updateSpaceEmbeddings(
    spaceId: string,
    titleEmbedding: Float32Array,
    descriptionEmbedding: Float32Array
  ): Promise<void> {
    await this.ensureInitialized();

    await this.client.execute({
      sql: `
        UPDATE spaces
        SET title_embedding = vector32(?),
            description_embedding = vector32(?)
        WHERE id = ?
      `,
      args: [
        serializeEmbedding(titleEmbedding),
        serializeEmbedding(descriptionEmbedding),
        spaceId
      ]
    });
  }

  /**
   * Search for spaces by semantic similarity to a query.
   * Uses title embeddings for fast lookup.
   *
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @returns Array of spaces ordered by similarity (highest first)
   */
  async searchSpaces(query: string, limit: number = 10): Promise<SpaceSearchResult[]> {
    await this.ensureInitialized();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k to find nearest neighbors
    const result = await this.client.execute({
      sql: `
        SELECT
          s.id, s.title, s.description,
          vector_distance_cos(s.title_embedding, vector32(?)) as distance
        FROM vector_top_k('spaces_title_vec_idx', vector32(?), ?)
        INNER JOIN spaces s ON s.rowid = vector_top_k.rowid
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit]
    });

    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      distance: row.distance as number,
      similarity: 1 - (row.distance as number) / 2  // Convert cosine distance to similarity
    }));
  }

  /**
   * Search for nodes within a specific space by semantic similarity.
   * Uses full_embedding for rich semantic search including meanings, values, etc.
   *
   * @param spaceId - The space to search within
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @param threshold - Minimum similarity threshold (0-1)
   * @returns Array of nodes ordered by similarity (highest first)
   */
  async searchNodesInSpace(
    spaceId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.5
  ): Promise<NodeSearchResult[]> {
    await this.ensureInitialized();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k and filter by space_id
    // Note: We fetch more results (limit * 3) before filtering to account for space filtering
    const result = await this.client.execute({
      sql: `
        SELECT
          n.node_key, n.space_id, n.data,
          vector_distance_cos(n.full_embedding, vector32(?)) as distance
        FROM vector_top_k('nodes_full_embedding_idx', vector32(?), ?)
        INNER JOIN nodes n ON n.rowid = vector_top_k.rowid
        WHERE n.space_id = ?
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit * 3, spaceId]
    });

    // Filter by threshold and limit results
    const distanceThreshold = (1 - threshold) * 2;  // Convert similarity to distance

    return result.rows
      .filter(row => (row.distance as number) <= distanceThreshold)
      .slice(0, limit)
      .map(row => {
        const nodeData = JSON.parse(row.data as string);
        const { fullContent } = extractNodeSemantics(nodeData);

        return {
          nodeKey: row.node_key as string,
          spaceId: row.space_id as string,
          content: fullContent,
          distance: row.distance as number,
          similarity: 1 - (row.distance as number) / 2
        };
      });
  }

  /**
   * Search across all nodes in all spaces by semantic similarity.
   * Useful for finding related concepts across the entire cognitive model.
   *
   * @param query - Natural language query text
   * @param limit - Maximum number of results to return
   * @param threshold - Minimum similarity threshold (0-1)
   * @returns Array of nodes ordered by similarity (highest first)
   */
  async searchAllNodes(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<NodeSearchResult[]> {
    await this.ensureInitialized();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = serializeEmbedding(queryEmbedding);

    // Use vector_top_k across all nodes
    const result = await this.client.execute({
      sql: `
        SELECT
          n.node_key, n.space_id, n.data,
          vector_distance_cos(n.full_embedding, vector32(?)) as distance
        FROM vector_top_k('nodes_full_embedding_idx', vector32(?), ?)
        INNER JOIN nodes n ON n.rowid = vector_top_k.rowid
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit * 2]
    });

    // Filter by threshold and limit results
    const distanceThreshold = (1 - threshold) * 2;  // Convert similarity to distance

    return result.rows
      .filter(row => (row.distance as number) <= distanceThreshold)
      .slice(0, limit)
      .map(row => {
        const nodeData = JSON.parse(row.data as string);
        const { fullContent } = extractNodeSemantics(nodeData);

        return {
          nodeKey: row.node_key as string,
          spaceId: row.space_id as string,
          content: fullContent,
          distance: row.distance as number,
          similarity: 1 - (row.distance as number) / 2
        };
      });
  }

  // ============================================================================
  // Embedded Replica Sync Methods
  // ============================================================================

  /**
   * Manually trigger a sync between the local replica and remote database.
   * Only works when using embedded replicas (file: URL with syncUrl).
   *
   * @returns Promise that resolves when sync completes
   * @throws Error if not using embedded replica or if sync fails
   */
  async sync(): Promise<void> {
    if (!this.isEmbeddedReplica) {
      throw new Error('Sync is only available for embedded replicas (file: URL with syncUrl)');
    }

    if (this.syncStats.isSyncing) {
      console.warn('Sync already in progress, skipping');
      return;
    }

    this.syncStats.isSyncing = true;
    this.syncStats.lastError = undefined;

    try {
      await this.client.sync();
      this.syncStats.syncCount++;
      this.syncStats.lastSyncedAt = Date.now();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.syncStats.lastError = errorMsg;
      throw new Error(`Sync failed: ${errorMsg}`);
    } finally {
      this.syncStats.isSyncing = false;
    }
  }

  /**
   * Start automatic background syncing at the specified interval.
   *
   * @param intervalSeconds - Seconds between syncs
   */
  private startAutoSync(intervalSeconds: number): void {
    if (!this.isEmbeddedReplica) {
      console.warn('Auto-sync is only available for embedded replicas');
      return;
    }

    // Clear any existing interval
    this.stopAutoSync();

    console.log(`Starting auto-sync every ${intervalSeconds} seconds`);
    this.syncIntervalId = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, intervalSeconds * 1000);

    // Perform initial sync in background (non-blocking)
    // Use setImmediate to ensure it doesn't block construction
    setImmediate(() => {
      this.sync().catch(error => {
        console.error('Initial sync failed:', error);
      });
    });
  }

  /**
   * Stop automatic background syncing.
   */
  stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Get current sync statistics.
   */
  getSyncStats(): Readonly<SyncStats> {
    return { ...this.syncStats };
  }

  /**
   * Check if this database is configured as an embedded replica.
   */
  isReplica(): boolean {
    return this.isEmbeddedReplica;
  }

  // ============================================================================
  // Claude CLI Session Management
  // ============================================================================

  /**
   * Save or update a Claude CLI session
   */
  async saveSession(session: {
    id: string;
    title?: string;
    spaceId?: string;
    messageCount: number;
  }): Promise<void> {
    await this.ensureInitialized();

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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

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
    await this.ensureInitialized();

    const result = await this.client.execute({
      sql: 'DELETE FROM sessions WHERE id = ?',
      args: [sessionId]
    });

    return result.rowsAffected > 0;
  }

  async close(): Promise<void> {
    this.stopAutoSync();
    this.client.close();
  }
}
