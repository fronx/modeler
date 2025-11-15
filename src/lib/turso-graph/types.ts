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
  syncOnStartup?: boolean;   // Sync before database is ready (default: true). Blocks initialization until sync succeeds.
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
