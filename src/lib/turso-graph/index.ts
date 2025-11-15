import { createClient, Client } from "@libsql/client";
import { DatabaseCore } from "./core";
import { SyncManager } from "./sync";
import { VectorSearch } from "./vector";
import { SpaceOperations } from "./spaces";
import { NodeOperations } from "./nodes";
import { EdgeOperations } from "./edges";
import { SessionOperations } from "./sessions";

export * from "./types";

export class TursoDatabase {
  private static instanceCount = 0;
  private static instanceRegistry = new Set<string>();
  private instanceId: string;
  private client: Client;

  private core: DatabaseCore;
  private syncManager: SyncManager;
  private vectorSearch: VectorSearch;
  private spaceOps: SpaceOperations;
  private nodeOps: NodeOperations;
  private edgeOps: EdgeOperations;
  private sessionOps: SessionOperations;

  private isEmbeddedReplica: boolean;
  private vectorSearchEnabled: boolean;

  constructor(config: import("./types").TursoDatabaseConfig = {}) {
    // Generate unique instance ID for tracking
    TursoDatabase.instanceCount++;
    this.instanceId = `db-${TursoDatabase.instanceCount}-${Date.now()}`;
    TursoDatabase.instanceRegistry.add(this.instanceId);

    console.log(`[DB Instance] Creating new TursoDatabase instance: ${this.instanceId}`);
    console.log(`[DB Instance] Total instances created: ${TursoDatabase.instanceCount}`);
    console.log(`[DB Instance] Active instances: ${TursoDatabase.instanceRegistry.size}`);

    if (TursoDatabase.instanceCount > 1) {
      console.warn(`⚠️  WARNING: Multiple TursoDatabase instances detected!`);
      console.warn(`   This may cause sync conflicts with embedded replicas.`);
      console.warn(`   Active instances: ${Array.from(TursoDatabase.instanceRegistry).join(', ')}`);
    }

    const url = config.url || process.env.TURSO_DATABASE_URL || "file:modeler.db";
    const syncUrl = config.syncUrl || process.env.TURSO_SYNC_URL;
    const syncInterval = config.syncInterval ?? (process.env.TURSO_SYNC_INTERVAL ? parseInt(process.env.TURSO_SYNC_INTERVAL) : 0);
    const syncOnStartup = config.syncOnStartup ?? true;

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

    // Initialize all modules
    this.syncManager = new SyncManager(this.client, this.isEmbeddedReplica);
    this.core = new DatabaseCore(
      this.client,
      this.isEmbeddedReplica,
      syncOnStartup,
      () => this.syncManager.sync()
    );
    this.vectorSearch = new VectorSearch(this.client, this.vectorSearchEnabled);
    this.spaceOps = new SpaceOperations(this.client);
    this.nodeOps = new NodeOperations(this.client);
    this.edgeOps = new EdgeOperations(this.client);
    this.sessionOps = new SessionOperations(this.client);

    // Set up automatic syncing if interval is specified and we're using embedded replica
    if (this.isEmbeddedReplica && syncInterval > 0) {
      this.syncManager.startAutoSync(syncInterval);
    }
  }

  // ============================================================================
  // Space Operations
  // ============================================================================

  async insertSpace(space: import("./types").CognitiveSpace): Promise<void> {
    await this.core.ensureInitialized();
    await this.spaceOps.insertSpace(space);
    await this.syncManager.syncAfterWrite();

    // Generate embeddings if enabled
    if (this.vectorSearchEnabled) {
      try {
        await this.vectorSearch.generateSpaceEmbeddings(
          space.metadata.id,
          space.metadata.title,
          space.metadata.description
        );
        await this.syncManager.syncAfterWrite();

        // Generate node embeddings in batches
        const nodeEntries = Object.entries(space.nodes);
        if (nodeEntries.length > 0) {
          await this.vectorSearch.updateNodesEmbeddingsBatch(space.metadata.id, nodeEntries);
        }
      } catch (error) {
        console.error('Failed to generate embeddings for space:', space.metadata.id, error);
        // Don't fail the entire operation if embedding generation fails
      }
    }
  }

  async getSpace(id: string): Promise<import("./types").CognitiveSpace | null> {
    await this.core.ensureInitialized();
    return this.spaceOps.getSpace(id);
  }

  async listSpaces(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    nodeCount: number;
  }>> {
    await this.core.ensureInitialized();
    return this.spaceOps.listSpaces();
  }

  async deleteSpace(id: string): Promise<boolean> {
    await this.core.ensureInitialized();
    const deleted = await this.spaceOps.deleteSpace(id);
    await this.syncManager.syncAfterWrite(deleted);
    return deleted;
  }

  async updateSpaceMetadata(
    spaceId: string,
    updates: { title?: string; description?: string }
  ): Promise<void> {
    await this.core.ensureInitialized();
    await this.spaceOps.updateSpaceMetadata(spaceId, updates);
    await this.syncManager.syncAfterWrite();
  }

  async appendGlobalHistory(spaceId: string, entry: string): Promise<void> {
    await this.core.ensureInitialized();
    await this.spaceOps.appendGlobalHistory(spaceId, entry);
    await this.syncManager.syncAfterWrite();
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  async deleteNode(spaceId: string, nodeKey: string): Promise<boolean> {
    await this.core.ensureInitialized();
    const deleted = await this.nodeOps.deleteNode(spaceId, nodeKey);
    await this.syncManager.syncAfterWrite(deleted);
    return deleted;
  }

  async upsertNode(spaceId: string, nodeKey: string, nodeData: any): Promise<void> {
    await this.core.ensureInitialized();
    await this.nodeOps.upsertNode(spaceId, nodeKey, nodeData);
    await this.syncManager.syncAfterWrite();

    // Generate embeddings if enabled
    if (this.vectorSearchEnabled) {
      await this.vectorSearch.updateNodeEmbeddings(spaceId, nodeKey, nodeData);
    }
  }

  async updateNodeField(
    spaceId: string,
    nodeKey: string,
    field: string,
    value: any
  ): Promise<void> {
    await this.core.ensureInitialized();
    await this.nodeOps.updateNodeField(spaceId, nodeKey, field, value);
    await this.syncManager.syncAfterWrite();
  }

  // ============================================================================
  // Edge Operations
  // ============================================================================

  async insertEdge(edge: {
    spaceId: string;
    sourceNode: string;
    targetNode: string;
    type: string;
    strength: number;
    gloss?: string;
  }): Promise<void> {
    await this.core.ensureInitialized();
    await this.edgeOps.insertEdge(edge);
    await this.syncManager.syncAfterWrite();
  }

  async listEdges(spaceId: string): Promise<Array<{
    id: string;
    sourceNode: string;
    targetNode: string;
    type: string;
    strength: number;
    gloss?: string;
  }>> {
    await this.core.ensureInitialized();
    return this.edgeOps.listEdges(spaceId);
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    await this.core.ensureInitialized();
    const deleted = await this.edgeOps.deleteEdge(edgeId);
    await this.syncManager.syncAfterWrite(deleted);
    return deleted;
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  async saveSession(session: {
    id: string;
    title?: string;
    spaceId?: string;
    messageCount: number;
  }): Promise<void> {
    await this.core.ensureInitialized();
    await this.sessionOps.saveSession(session);
    await this.syncManager.syncAfterWrite();
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.core.ensureInitialized();
    await this.sessionOps.touchSession(sessionId);
    await this.syncManager.syncAfterWrite();
  }

  async listSessions(): Promise<Array<{
    id: string;
    title: string | null;
    spaceId: string | null;
    messageCount: number;
    createdAt: number;
    lastUsedAt: number;
  }>> {
    await this.core.ensureInitialized();
    return this.sessionOps.listSessions();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.core.ensureInitialized();
    const deleted = await this.sessionOps.deleteSession(sessionId);
    await this.syncManager.syncAfterWrite(deleted);
    return deleted;
  }

  // ============================================================================
  // Vector Search Operations
  // ============================================================================

  async updateSpaceEmbeddings(
    spaceId: string,
    titleEmbedding: Float32Array,
    descriptionEmbedding: Float32Array
  ): Promise<void> {
    await this.core.ensureInitialized();
    await this.vectorSearch.updateSpaceEmbeddings(spaceId, titleEmbedding, descriptionEmbedding);
    await this.syncManager.syncAfterWrite();
  }

  async searchSpaces(query: string, limit: number = 10): Promise<import("./types").SpaceSearchResult[]> {
    await this.core.ensureInitialized();
    return this.vectorSearch.searchSpaces(query, limit);
  }

  async searchNodesInSpace(
    spaceId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.5
  ): Promise<import("./types").NodeSearchResult[]> {
    await this.core.ensureInitialized();
    return this.vectorSearch.searchNodesInSpace(spaceId, query, limit, threshold);
  }

  async searchAllNodes(
    query: string,
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<import("./types").NodeSearchResult[]> {
    await this.core.ensureInitialized();
    return this.vectorSearch.searchAllNodes(query, limit, threshold);
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  async sync(): Promise<void> {
    return this.syncManager.sync();
  }

  async resync(): Promise<string | null> {
    this.core.resetInitialized();
    return this.syncManager.resync(() => this.core.ensureInitialized());
  }

  stopAutoSync(): void {
    this.syncManager.stopAutoSync();
  }

  suspendAutoSync(): void {
    this.syncManager.suspendAutoSync();
  }

  resumeAutoSync(): void {
    this.syncManager.resumeAutoSync();
  }

  async withSuspendedAutoSync<T>(fn: () => Promise<T>): Promise<T> {
    return this.syncManager.withSuspendedAutoSync(fn);
  }

  getSyncStats(): Readonly<import("./types").SyncStats> {
    return this.syncManager.getSyncStats();
  }

  isReplica(): boolean {
    return this.isEmbeddedReplica;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async close(): Promise<void> {
    this.syncManager.stopAutoSync();
    this.client.close();

    // Remove from registry
    TursoDatabase.instanceRegistry.delete(this.instanceId);
    console.log(`[DB Instance] Closed instance: ${this.instanceId}`);
    console.log(`[DB Instance] Remaining active instances: ${TursoDatabase.instanceRegistry.size}`);
  }
}
