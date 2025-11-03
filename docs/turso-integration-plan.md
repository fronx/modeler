# Turso Integration Plan

## Current State Analysis

### Existing Database Architecture

The project currently uses **PostgreSQL** with the `pg` npm package for data persistence. The architecture is built around a cognitive modeling system that stores "spaces" containing thought nodes.

#### Current Database Schema

```sql
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    data JSONB NOT NULL,                    -- Contains nodes and globalHistory
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Features:**
- JSONB storage for flexible cognitive space data
- GIN index on `data` column for fast JSON queries
- Automatic `updated_at` trigger
- PostgreSQL LISTEN/NOTIFY for real-time WebSocket push notifications

#### Current Database Interface

**Location:** `src/lib/database.ts`

**Interface Methods:**
```typescript
class Database {
  constructor(config: DatabaseConfig)
  async insertSpace(space: CognitiveSpace): Promise<void>
  async getSpace(id: string): Promise<CognitiveSpace | null>
  async listSpaces(): Promise<Array<SpaceListItem>>
  async deleteSpace(id: string): Promise<boolean>
  async close(): Promise<void>
}
```

**Data Structure:**
```typescript
interface CognitiveSpace {
  metadata: {
    id: string;
    title: string;
    description: string;
    createdAt: number;
  };
  nodes: Record<string, any>;      // Thought nodes with semantic/numerical data
  globalHistory: string[];          // Event log
}
```

### Current Usage Patterns

The database is used in two primary contexts:

#### 1. Next.js API Routes (6 files)
- `src/app/api/spaces/route.ts` - GET (list), POST (create), PUT (full update)
- `src/app/api/spaces/[spaceId]/route.ts` - GET, PUT, PATCH, DELETE
- `src/app/api/spaces/[spaceId]/thoughts/route.ts`
- `src/app/api/spaces/[spaceId]/thoughts-direct/route.ts`
- `src/app/api/spaces/[spaceId]/check-item/route.ts`

**Pattern:** Short-lived connections
```typescript
const db = new Database();
try {
  // Operation
} finally {
  await db.close();
}
```

#### 2. WebSocket Server (Real-time Updates)
- `src/lib/websocket-server.ts` - Long-lived connection for PostgreSQL LISTEN/NOTIFY

**Pattern:** Dedicated notification client
```typescript
// Separate pg.Client for LISTEN/NOTIFY
await this.notificationClient.query('LISTEN space_changes');
this.notificationClient.on('notification', async (msg) => {
  // Broadcast to WebSocket clients
});
```

**Critical Feature:** PostgreSQL `pg_notify()` triggers send push notifications on INSERT/UPDATE/DELETE, eliminating polling.

---

## Turso/libSQL Capabilities Research

### What is Turso?

Turso is a distributed SQLite platform (built on libSQL) offering:
- **Edge deployment** - Deploy databases close to users globally
- **Embedded replicas** - Local-first with sync to remote
- **Vector search** - Native embedding support without extensions
- **Cost efficiency** - SQLite's resource efficiency at scale

### Vector Search & AI Features

Based on Turso documentation research:

#### 1. Native Vector Types (No Extensions Required)

Six vector formats with different precision/size tradeoffs:
- `FLOAT32/F32_BLOB` - Recommended starting point (4 bytes per dimension)
- `FLOAT64/F64_BLOB` - Maximum precision (8 bytes per dimension)
- `FLOAT16/F16_BLOB` - Half precision (2 bytes per dimension)
- `FLOAT1BIT/F1BIT_BLOB` - Binary embeddings (1 bit per dimension)

**Example Schema:**
```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  label TEXT,
  embedding F32_BLOB(768)  -- 768-dimensional vector
);
```

#### 2. Vector Operations

**Distance Functions:**
- `vector_distance_cos()` - Cosine distance (1 - cosine similarity)
  - Range: 0 (identical) to 2 (opposite directions)
- Euclidean distance support

**Vector Indexing:**
```sql
CREATE INDEX idx_embedding ON nodes (
  libsql_vector_idx(embedding,
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);
```

**Similarity Search:**
```sql
SELECT n.id, n.label,
  vector_distance_cos(n.embedding, ?) AS distance
FROM vector_top_k('idx_embedding', ?, 10)
INNER JOIN nodes n ON rowid = n.rowid
ORDER BY distance;
```

#### 3. Knowledge Graph Pattern

From Turso's React Native blog post - two-table pattern:

```sql
-- Nodes (entities)
CREATE TABLE node (
  id TEXT PRIMARY KEY,
  label TEXT,
  vectorLabel F32_BLOB(512)
);

-- Edges (relationships)
CREATE TABLE edge (
  id TEXT PRIMARY KEY,
  fromId TEXT,
  toId TEXT,
  label TEXT,
  vectorTriple F32_BLOB(512)  -- Embedding of (from, relation, to)
);
```

**Key Insight:** Embed both nodes AND relationships for semantic graph traversal.

### SDK & API

**Package:** `@libsql/client`

**Client Types:**
```typescript
import { createClient } from "@libsql/client";

// Local file
const local = createClient({ url: "file:local.db" });

// Remote (Turso hosted)
const remote = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Embedded replica (local + sync)
const replica = createClient({
  url: "file:local.db",
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

await replica.sync();  // Sync local with remote
```

**Query API:**
```typescript
// Simple query
const result = await client.execute("SELECT * FROM spaces");

// Parameterized (positional)
await client.execute({
  sql: "SELECT * FROM spaces WHERE id = ?",
  args: [spaceId]
});

// Parameterized (named)
await client.execute({
  sql: "SELECT * FROM spaces WHERE id = :id",
  args: { id: spaceId }
});

// Batch operations
await client.batch([
  { sql: "INSERT INTO ...", args: [...] },
  { sql: "INSERT INTO ...", args: [...] }
]);
```

**Result Format:**
```typescript
interface ResultSet {
  rows: Array<Record<string, any>>;
  columns: string[];
  rowsAffected: number;
  lastInsertRowid?: bigint;
}
```

---

## Integration Plan

### Design Principles

1. **Non-disruptive:** Leave existing PostgreSQL implementation untouched
2. **Interface compatibility:** Match existing `Database` class API
3. **Feature parity first:** Implement core CRUD before adding vector search
4. **Gradual enhancement:** Add vector capabilities as a second phase
5. **Environment-based selection:** Use env vars to choose database backend

### Phase 1: Core Implementation (Normalized Schema)

**Goal:** Relational design with nodes as first-class entities

**Scope:**
- ✅ Three tables: `spaces`, `nodes`, `history`
- ✅ Nodes stored as separate rows (not embedded in JSON)
- ✅ History entries as separate rows
- ✅ Node data (meanings, values, relationships) stored as JSON per node
- ✅ All CRUD methods working with the new schema
- ❌ No vector embeddings yet (Phase 2)

#### File Structure
```
src/lib/
├── database.ts           # Existing PostgreSQL (unchanged)
├── turso-database.ts     # New Turso implementation
└── database-factory.ts   # Optional: Runtime selection
```

#### Schema Design

**Normalized Relational Schema:**
```sql
-- Spaces: Just metadata, no embedded data
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,     -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL
);

CREATE INDEX spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX spaces_updated_at_idx ON spaces (updated_at DESC);

-- Nodes: Each node is a separate row
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,                 -- Generated: `${space_id}:${node_key}`
    space_id TEXT NOT NULL,
    node_key TEXT NOT NULL,              -- e.g., "DirectTransmission" (user identifier)
    data TEXT NOT NULL,                  -- JSON: meanings, values, relationships, etc.
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(space_id, node_key),          -- Each space has its own namespace
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX nodes_space_id_idx ON nodes(space_id);
CREATE INDEX nodes_updated_at_idx ON nodes(updated_at DESC);

-- History: One row per history entry
CREATE TABLE history (
    id TEXT PRIMARY KEY,                 -- Generated UUID or autoincrement
    space_id TEXT NOT NULL,
    entry TEXT NOT NULL,                 -- The history message
    created_at INTEGER NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX history_space_id_idx ON history(space_id);
CREATE INDEX history_created_at_idx ON history(created_at DESC);
```

**Migration from PostgreSQL:**
- **Spaces:** Extract metadata only (id, title, description, timestamps)
- **Nodes:** Unpack `data.nodes` object into separate rows
- **History:** Unpack `data.globalHistory` array into separate rows

#### Implementation: `TursoDatabase` class

```typescript
import { createClient, Client } from "@libsql/client";
import type { CognitiveSpace } from './database';

export interface TursoDatabaseConfig {
  url?: string;              // file:local.db or https://...
  authToken?: string;        // For remote/replica
  syncUrl?: string;          // For embedded replica
}

export class TursoDatabase {
  private client: Client;

  constructor(config: TursoDatabaseConfig = {}) {
    this.client = createClient({
      url: config.url || process.env.TURSO_DATABASE_URL || "file:modeler.db",
      authToken: config.authToken || process.env.TURSO_AUTH_TOKEN,
      syncUrl: config.syncUrl || process.env.TURSO_SYNC_URL
    });
  }

  async insertSpace(space: CognitiveSpace): Promise<void> {
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
    for (const entry of space.globalHistory) {
      statements.push({
        sql: `
          INSERT INTO history (id, space_id, entry, created_at)
          VALUES (?, ?, ?, ?)
        `,
        args: [
          `${space.metadata.id}:${Date.now()}:${Math.random()}`,  // Unique ID
          space.metadata.id,
          entry,
          now
        ]
      });
    }

    await this.client.batch(statements, 'write');
  }

  async getSpace(id: string): Promise<CognitiveSpace | null> {
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
      nodeCount: row.node_count as number
    }));
  }

  async deleteSpace(id: string): Promise<boolean> {
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
```

#### Challenges & Solutions

**Challenge 1: PostgreSQL LISTEN/NOTIFY**
- **Problem:** WebSocket server relies on `pg_notify()` for real-time push
- **Solution:**
  - Turso doesn't have LISTEN/NOTIFY equivalent
  - **Recommended approach:** Update-then-reload pattern
    - After any write operation (INSERT/UPDATE/DELETE), explicitly broadcast updated data
    - WebSocket server's `broadcastSpaceUpdate()` method already exists
    - Simply call it after database operations complete
  - **Benefits:**
    - No polling overhead
    - Guaranteed consistency (data is fresh after write)
    - Simple to implement - just trigger broadcasts after writes
    - Aligns with write patterns (API routes already handle writes)
  - **Implementation example:**
    ```typescript
    // In API route after database write
    await db.insertSpace(space);

    // Trigger WebSocket broadcast
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(space.metadata.id);
    }
    ```

**Challenge 2: Data Model Migration**
- **Problem:** PostgreSQL stores everything as nested JSON in one row
- **New design:** Relational schema with nodes and history as separate tables
- **Benefits:**
  - Node counting via SQL JOIN (no JSON parsing needed!)
  - Individual node updates without rewriting entire space
  - Queryable: Can filter/search nodes directly
  - Better for indexing and vector embeddings (Phase 2)
- **Trade-off:** More complex writes (need transactions for consistency)
  - Solution: Use `client.batch()` for transactional multi-table writes

**Challenge 3: Connection Pooling**
- **Problem:** PostgreSQL uses `pg.Pool`, libSQL client is connection-per-instance
- **Solution:**
  - For local file: Single client instance is fine (SQLite handles concurrency)
  - For remote: Client handles connection internally
  - Match existing pattern: create/close per request (works with libSQL)

### Phase 2: Vector Search Enhancement

**Goal:** Enable semantic search over thought nodes

#### Understanding Node Structure

Current thought nodes have this structure:
```typescript
{
  id: string;              // Node identifier (e.g., "DirectTransmission")
  meanings: Array<{        // Rich semantic descriptions
    content: string;       // The meaning/description
    confidence: number;
    timestamp: number;
  }>;
  values: Record<string, any>;      // Numerical/categorical attributes
  relationships: Array<{...}>;
  history: string[];       // Event log for this node
  // ... other fields
}
```

**Key insight:** Nodes already have rich semantic content via the `meanings` array, not just a simple label. This is perfect for embeddings!

#### Extended Schema (Add Vector Columns)

```sql
-- Add vector embeddings to spaces table
ALTER TABLE spaces ADD COLUMN title_embedding F32_BLOB(768);
ALTER TABLE spaces ADD COLUMN description_embedding F32_BLOB(768);

CREATE INDEX spaces_title_vec_idx ON spaces (
  libsql_vector_idx(title_embedding,
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);

-- Add vector embeddings to nodes table (already normalized!)
ALTER TABLE nodes ADD COLUMN title_embedding F32_BLOB(768);
ALTER TABLE nodes ADD COLUMN full_embedding F32_BLOB(768);

CREATE INDEX nodes_title_embedding_idx ON nodes (
  libsql_vector_idx(title_embedding,
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);

CREATE INDEX nodes_full_embedding_idx ON nodes (
  libsql_vector_idx(full_embedding,
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);
```

**Note:** Since Phase 1 already normalizes nodes into separate rows, we just add embedding columns! No additional denormalization needed.

**Title vs Description Strategy:**
- **Title:** Extract from `node.id` (e.g., "DirectTransmission" → "Direct Transmission")
- **Description:** Concatenate `node.meanings[].content` with newlines
- **Full semantic content:** Include values, relationships for complete context

**Utility for extracting:**
```typescript
function extractNodeSemantics(node: any) {
  // Title from camelCase/PascalCase ID
  const title = node.id.replace(/([A-Z])/g, ' $1').trim();

  // Description from meanings
  const description = node.meanings
    ?.map((m: any) => m.content)
    .join('\n') || '';

  // Full semantic content
  const valuesSummary = Object.entries(node.values || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const fullContent = `${title}\n${description}\nAttributes: ${valuesSummary}`;

  return { title, description, fullContent };
}
```

#### New Methods for Vector Search

```typescript
export class TursoDatabase {
  // ... existing methods ...

  // Semantic search over space titles/descriptions
  async searchSpaces(
    queryEmbedding: Float32Array,
    limit: number = 10
  ): Promise<Array<SpaceSearchResult>> {
    // Serialize embedding for libSQL
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    const result = await this.client.execute({
      sql: `
        SELECT
          s.id, s.title, s.description,
          vector_distance_cos(s.title_embedding, vector32(?)) as distance
        FROM vector_top_k('spaces_title_vec_idx', vector32(?), ?)
        INNER JOIN spaces s ON rowid = s.rowid
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit]
    });

    return result.rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      similarity: 1 - (row.distance as number) / 2  // Convert distance to similarity
    }));
  }

  // Search within a specific space's thought nodes
  async searchNodesInSpace(
    spaceId: string,
    queryEmbedding: Float32Array,
    limit: number = 5
  ): Promise<Array<NodeSearchResult>> {
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    const result = await this.client.execute({
      sql: `
        SELECT
          tn.node_key, tn.semantic_content,
          vector_distance_cos(tn.embedding, vector32(?)) as distance
        FROM vector_top_k('nodes_embedding_idx', vector32(?), ?)
        INNER JOIN thought_nodes tn ON rowid = tn.rowid
        WHERE tn.space_id = ?
        ORDER BY distance
      `,
      args: [embeddingStr, embeddingStr, limit * 2, spaceId]
    });

    return result.rows
      .filter(row => (row.distance as number) < 0.7)  // Threshold
      .slice(0, limit)
      .map(row => ({
        nodeKey: row.node_key as string,
        content: row.semantic_content as string,
        similarity: 1 - (row.distance as number) / 2
      }));
  }

  // Update embeddings (batch operation)
  async updateSpaceEmbeddings(
    spaceId: string,
    titleEmbedding: Float32Array,
    descriptionEmbedding: Float32Array
  ): Promise<void> {
    await this.client.execute({
      sql: `
        UPDATE spaces
        SET title_embedding = vector32(?),
            description_embedding = vector32(?)
        WHERE id = ?
      `,
      args: [
        `[${Array.from(titleEmbedding).join(',')}]`,
        `[${Array.from(descriptionEmbedding).join(',')}]`,
        spaceId
      ]
    });
  }
}
```

#### Embedding Generation Strategy

**Options:**
1. **OpenAI Embeddings API** - `text-embedding-3-small` (1536 dims)
2. **Transformers.js** - Run in Node.js/browser (e.g., `all-MiniLM-L6-v2`)
3. **External service** - Cohere, Voyage AI

**Recommendation:** Start with OpenAI for simplicity, optimize later.

**Integration Point:**
```typescript
// New utility: src/lib/embeddings.ts
import OpenAI from 'openai';

export async function generateEmbedding(text: string): Promise<Float32Array> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 768  // Match F32_BLOB(768) in schema
  });

  return new Float32Array(response.data[0].embedding);
}
```

**Auto-update embeddings on space creation/update:**
```typescript
// In API route
const space = await db.getSpace(spaceId);
const titleEmb = await generateEmbedding(space.metadata.title);
const descEmb = await generateEmbedding(space.metadata.description);
await db.updateSpaceEmbeddings(spaceId, titleEmb, descEmb);
```

---

## Migration Strategy

### Option A: Parallel Running (Recommended for Testing)

Both databases run side-by-side for comparison:

```typescript
// src/lib/database-factory.ts
export function createDatabase() {
  const dbType = process.env.DATABASE_TYPE || 'postgres';

  if (dbType === 'turso') {
    return new TursoDatabase();
  } else {
    return new Database();
  }
}

// Usage in API routes
import { createDatabase } from '@/lib/database-factory';

const db = createDatabase();
```

**Advantages:**
- Safe rollback (change env var)
- A/B testing possible
- Gradual migration

### Option B: Data Export/Import Tool

Migrate existing PostgreSQL data to Turso:

```typescript
// scripts/migrate-to-turso.ts
import { Database } from './src/lib/database';
import { TursoDatabase } from './src/lib/turso-database';

async function migrate() {
  const pgDb = new Database();
  const tursoDb = new TursoDatabase();

  const spaces = await pgDb.listSpaces();
  console.log(`Migrating ${spaces.length} spaces...`);

  for (const spaceMeta of spaces) {
    const space = await pgDb.getSpace(spaceMeta.id);
    if (space) {
      await tursoDb.insertSpace(space);
      console.log(`✓ Migrated space: ${space.metadata.title}`);
    }
  }

  await pgDb.close();
  await tursoDb.close();
  console.log('Migration complete');
}

migrate();
```

---

## Next Steps

### Immediate (Phase 1)
1. Install `@libsql/client` package
2. Create `src/lib/turso-database.ts` with core interface
3. Create schema initialization script (`scripts/init-turso-schema.sql`)
4. Implement all 5 core methods with test coverage
5. Add environment variable configuration
6. Test with local file database first
7. Update API routes to trigger WebSocket broadcasts after writes (update-then-reload pattern)

### Future (Phase 2)
1. Design node-level embedding schema
2. Add vector search methods to `TursoDatabase`
3. Integrate embedding generation (OpenAI/Transformers.js)
4. Create API endpoints for semantic search
5. Add UI for semantic search in dashboard
6. Benchmark query performance vs PostgreSQL
7. Optimize with embedded replicas for edge deployment

### Design Decisions Made

1. ✅ **Real-time updates:** Update-then-reload pattern (explicit broadcast after writes)
2. ✅ **Schema design:** Normalized relational schema (spaces, nodes, history tables)
3. ✅ **Nodes as first-class entities:** Each node is a separate row (not JSON-embedded)
4. ✅ **Node counting:** SQL JOIN with COUNT (cleaner than JSON parsing)
5. ✅ **Primary keys:** Composite `${space_id}:${node_key}` with UNIQUE constraint
6. ✅ **Namespace isolation:** Each space has its own namespace for node keys
7. ✅ **Table naming:** "nodes" not "thought_nodes" (generic, supports future tagging)

### Questions to Resolve (Phase 2)
1. **Embedding model:** OpenAI vs local model? Dimension size?
2. **Deployment:** Local file vs Turso hosted vs embedded replica?
3. **Cost:** Turso pricing tier for expected usage?
4. **Graph embeddings:** Embed nodes only, or also edges/relationships?

---

## Key Turso Advantages for This Project

1. **Semantic Search:** Find similar cognitive spaces or related thought nodes
2. **Edge Deployment:** Deploy spaces close to users globally
3. **Local-first:** Embedded replicas enable offline-capable cognitive tools
4. **Cost Efficiency:** SQLite's low resource usage
5. **Developer Experience:** Simple client, no connection pooling complexity

## Potential Challenges

1. **No LISTEN/NOTIFY:** Solved with update-then-broadcast pattern (explicit refresh after writes)
2. **JSON Querying:** Less powerful than PostgreSQL JSONB operators (use application-layer logic)
3. **Concurrency:** SQLite write locking (less issue with libSQL server mode)
4. **Maturity:** Newer platform vs battle-tested PostgreSQL
5. **Ecosystem:** Fewer tools/integrations than PostgreSQL

---

## Conclusion

Turso/libSQL offers compelling capabilities for this cognitive modeling project, particularly with native vector search. The integration plan preserves existing PostgreSQL functionality while introducing Turso as an alternative backend with semantic search superpowers.

**Recommendation:**
- Start with Phase 1 (feature parity) using local file database
- Test thoroughly against existing PostgreSQL behavior
- Add Phase 2 (vector search) once core functionality is stable
- Deploy with embedded replicas for optimal local-first experience

The "code-as-gesture" philosophy of this project aligns well with Turso's lightweight, embeddable nature - cognitive spaces become truly portable artifacts.
