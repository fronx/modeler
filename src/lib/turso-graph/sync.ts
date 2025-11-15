import { Client } from "@libsql/client";
import { SyncStats } from "./types";

export class SyncManager {
  private syncStats: SyncStats = {
    syncCount: 0,
    isSyncing: false
  };
  private syncIntervalId?: NodeJS.Timeout;
  private syncQueue: Promise<void> = Promise.resolve();
  private autoSyncSuspended = false;

  constructor(
    private client: Client,
    private isEmbeddedReplica: boolean
  ) {}

  /**
   * Helper method to sync after write operations (fire-and-forget).
   * Only syncs if using embedded replica and a change was actually made.
   * This ensures local changes are pushed to remote immediately (Option 1: Aggressive Immediate Sync).
   *
   * Runs async without blocking the caller - errors are logged but don't fail the operation.
   *
   * @param changed - Whether the operation actually modified data (default: true)
   */
  async syncAfterWrite(changed: boolean = true): Promise<void> {
    if (!changed || !this.isEmbeddedReplica) {
      return;
    }

    // Suspend auto-sync while we're doing immediate post-write sync
    // This prevents the background timer from racing with our explicit sync
    this.suspendAutoSync();

    try {
      // Chain sync requests to run sequentially so we never drop a write.
      this.syncQueue = this.syncQueue.then(() => this.sync());
      await this.syncQueue;
    } catch (error) {
      // Reset queue so future writes can attempt another sync.
      this.syncQueue = Promise.resolve();
      throw error;
    } finally {
      // Always resume auto-sync, even if sync failed
      this.resumeAutoSync();
    }
  }

  /**
   * Manually trigger a sync between the local replica and remote database.
   * Only works when using embedded replicas (file: URL with syncUrl).
   *
   * Automatically retries on transient lock errors with exponential backoff.
   *
   * @returns Promise that resolves when sync completes
   * @throws Error if not using embedded replica or if sync fails after retries
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

    const maxRetries = 3;
    const baseDelay = 100; // Start with 100ms

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await this.client.sync();
          this.syncStats.syncCount++;
          this.syncStats.lastSyncedAt = Date.now();
          return; // Success
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.syncStats.lastError = errorMsg;

          // Check for frame mismatch error indicating local DB is behind
          if (errorMsg.includes('InvalidPushFrameNoHigh')) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('SYNC CONFLICT: Local database is behind remote');
            console.error('This indicates the local and remote databases have diverged.');
            console.error('');
            console.error('To recover:');
            console.error('  1. Stop the server');
            console.error('  2. Run: npx tsx scripts/force-resync.ts');
            console.error('  3. Restart the server');
            console.error('');
            console.error('Error:', errorMsg);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Don't try automatic resync - it's too destructive and may fail anyway
            // Let the error propagate so the operation fails visibly
            throw new Error(`Sync conflict: Local database behind remote. Manual resync required. ${errorMsg}`);
          }

          // Check for transient lock errors that can be retried
          const isLockError = errorMsg.includes('database is locked') || errorMsg.includes('SQLITE_BUSY');

          if (isLockError && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 100ms, 200ms, 400ms
            console.warn(`[Sync] Database locked (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry
          }

          // Non-retryable error or max retries exceeded
          if (isLockError) {
            throw new Error(`Sync failed after ${maxRetries + 1} attempts: ${errorMsg}`);
          }

          throw new Error(`Sync failed: ${errorMsg}`);
        }
      }
    } finally {
      this.syncStats.isSyncing = false;
    }
  }

  /**
   * Force a complete resync from remote Turso database.
   * This rebuilds the local database from scratch.
   *
   * WARNING: This will discard any local changes that haven't been synced.
   * A timestamped backup is created before deletion.
   * Only use this when the local database is corrupted or out of sync.
   *
   * @returns Path to the backup file created
   */
  async resync(ensureInitialized: () => Promise<void>): Promise<string | null> {
    if (!this.isEmbeddedReplica) {
      throw new Error('Resync is only available for embedded replicas');
    }

    console.log('Starting full resync from remote...');

    // Close the current client
    this.client.close();

    // Backup and delete local database files
    const dbPath = (process.env.TURSO_DATABASE_URL || 'file:modeler.db').replace('file:', '');
    const fs = await import('fs');
    const path = await import('path');

    let backupPath: string | null = null;

    try {
      // Backup database file only (metadata is just sync state, not user data)
      if (fs.existsSync(dbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = path.dirname(dbPath);
        const basename = path.basename(dbPath);
        backupPath = path.join(dir, `${basename}.backup-${timestamp}`);

        fs.copyFileSync(dbPath, backupPath);
        console.log(`Created backup: ${backupPath}`);
      }

      // CRITICAL: Delete metadata FIRST to avoid "metadata exists but db doesn't" error
      const metadataPath = `${dbPath}-sync-metadata`;
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
        console.log(`Removed sync metadata`);
      }

      // Delete WAL files
      const shmPath = `${dbPath}-shm`;
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }

      const walPath = `${dbPath}-wal`;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }

      // Delete info file (contains libsql metadata)
      const infoPath = `${dbPath}-info`;
      if (fs.existsSync(infoPath)) {
        fs.unlinkSync(infoPath);
        console.log(`Removed info file`);
      }

      // Delete database file last
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`Removed local database`);
      }
    } catch (error) {
      console.error('Error during resync file operations:', error);
      throw new Error('Failed to backup/remove local database files for resync');
    }

    // Recreate client - this will trigger a fresh sync from remote
    const syncUrl = process.env.TURSO_SYNC_URL;
    const useOfflineMode = this.isEmbeddedReplica;

    const { createClient } = await import("@libsql/client");
    const newClient = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
      syncUrl,
      offline: useOfflineMode
    });

    // Replace the old client
    Object.assign(this.client, newClient);

    // Pull all data from remote FIRST
    await this.client.sync();
    this.syncStats.syncCount++;
    this.syncStats.lastSyncedAt = Date.now();

    // THEN ensure schema exists (in case Turso doesn't have it or it's outdated)
    await ensureInitialized();

    console.log('Resync completed - local database rebuilt from remote');
    if (backupPath) {
      console.log(`Old database backed up to: ${backupPath}`);
    }

    return backupPath;
  }

  /**
   * Start automatic background syncing at the specified interval.
   *
   * @param intervalSeconds - Seconds between syncs
   */
  startAutoSync(intervalSeconds: number): void {
    if (!this.isEmbeddedReplica) {
      console.warn('Auto-sync is only available for embedded replicas');
      return;
    }

    // Clear any existing interval
    this.stopAutoSync();

    console.log(`Starting auto-sync every ${intervalSeconds} seconds`);
    this.syncIntervalId = setInterval(async () => {
      // Skip auto-sync if suspended during write operations
      if (this.autoSyncSuspended) {
        console.log('[Auto-sync] Skipped (suspended during write operation)');
        return;
      }

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
   * Suspend auto-sync during write operations to prevent conflicts.
   * Auto-sync will be skipped until resumed.
   */
  suspendAutoSync(): void {
    if (!this.isEmbeddedReplica) return;
    this.autoSyncSuspended = true;
  }

  /**
   * Resume auto-sync after write operations complete.
   */
  resumeAutoSync(): void {
    if (!this.isEmbeddedReplica) return;
    this.autoSyncSuspended = false;
  }

  /**
   * Execute a function with auto-sync suspended, then resume.
   * Ensures auto-sync is always resumed even if the function throws.
   */
  async withSuspendedAutoSync<T>(fn: () => Promise<T>): Promise<T> {
    this.suspendAutoSync();
    try {
      return await fn();
    } finally {
      this.resumeAutoSync();
    }
  }

  /**
   * Get current sync statistics.
   */
  getSyncStats(): Readonly<SyncStats> {
    return { ...this.syncStats };
  }
}
