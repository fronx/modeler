# Turso Integration Plan

## ✅ Implementation Status

### Phase 1: Core Implementation - **COMPLETED**

**Implementation Date:** January 2025

All Phase 1 goals have been successfully implemented and tested:
- ✅ Normalized relational schema (spaces, nodes, history tables)
- ✅ TursoDatabase class with full CRUD support
- ✅ Database factory for runtime backend selection
- ✅ All API routes updated to use factory pattern
- ✅ WebSocket broadcasts work with both PostgreSQL and Turso
- ✅ Local file database tested and verified
- ✅ Update-then-reload pattern for real-time updates

**Key Files:**
- Schema: [`scripts/init-turso-schema.sql`](../scripts/init-turso-schema.sql)
- Implementation: [`src/lib/turso-database.ts`](../src/lib/turso-database.ts)
- Factory: [`src/lib/database-factory.ts`](../src/lib/database-factory.ts)
- WebSocket: [`src/lib/websocket-server.ts`](../src/lib/websocket-server.ts)
- Test: [`test-turso.ts`](../test-turso.ts)
- Documentation: [`docs/turso-usage.md`](./turso-usage.md)

**Usage:**
```bash
# Switch to Turso
export DATABASE_TYPE=turso
npm run dev

# Switch to PostgreSQL
export DATABASE_TYPE=postgres
npm run dev
```

---

### Phase 2: Vector Search Enhancement - **COMPLETED**

**Implementation Date:** November 2025

All Phase 2 goals have been successfully implemented:
- ✅ Vector embedding columns added to schema (F32_BLOB(768))
- ✅ Vector indices created with DiskANN algorithm
- ✅ Embedding generation utility (OpenAI text-embedding-3-small)
- ✅ Automatic embedding generation on space insert/update
- ✅ Semantic search methods (spaces, nodes, space-specific nodes)
- ✅ API endpoints for vector search
- ✅ Migration script for existing databases
- ✅ Comprehensive test suite

**Key Files:**
- Vector Schema: [`scripts/add-vector-embeddings.sql`](../scripts/add-vector-embeddings.sql)
- Embeddings Utility: [`src/lib/embeddings.ts`](../src/lib/embeddings.ts)
- Search Methods: [`src/lib/turso-database.ts`](../src/lib/turso-database.ts#L241) (lines 241-444)
- API Endpoints:
  - [`src/app/api/search/spaces/route.ts`](../src/app/api/search/spaces/route.ts)
  - [`src/app/api/search/nodes/route.ts`](../src/app/api/search/nodes/route.ts)
- Migration: [`scripts/migrate-add-vectors.ts`](../scripts/migrate-add-vectors.ts)
- Test: [`test-vector-search.ts`](../test-vector-search.ts)
- Documentation: [`docs/vector-search-usage.md`](./vector-search-usage.md)

**Usage:**
```bash
# Enable vector search
export ENABLE_VECTOR_SEARCH=true
export OPENAI_API_KEY=your-key
export DATABASE_TYPE=turso

# Migrate existing database
npx tsx scripts/migrate-add-vectors.ts

# Test vector search
npx tsx test-vector-search.ts

# Use semantic search APIs
curl "http://localhost:3000/api/search/spaces?q=learning+and+memory"
curl "http://localhost:3000/api/search/nodes?q=trust+without+evidence"
```

---

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

### Phase 1: Core Implementation (Normalized Schema) - ✅ COMPLETED

**Status:** Fully implemented and tested

**Implementation:**
- Schema: [`scripts/init-turso-schema.sql`](../scripts/init-turso-schema.sql) - Normalized relational design with 3 tables
- Database class: [`src/lib/turso-database.ts`](../src/lib/turso-database.ts) - Full CRUD implementation
- Factory: [`src/lib/database-factory.ts`](../src/lib/database-factory.ts) - Runtime backend selection

**Schema Overview:**
- `spaces` table - Metadata only (id, title, description, timestamps)
- `nodes` table - Each node as separate row with JSON data
- `history` table - Each history entry as separate row

See the schema file for full DDL.

**Key Design Decisions:**
- Normalized schema allows efficient node counting via SQL JOIN
- Individual node updates without rewriting entire space
- Queryable nodes by space or timestamp
- Ready for vector embeddings in Phase 2

**Implementation Challenges Solved:**

1. **Real-time Updates (LISTEN/NOTIFY replacement)**
   - Implemented update-then-reload pattern
   - API routes explicitly trigger `broadcastSpaceUpdate()` after writes
   - See: All API route files now call `getThoughtWebSocketServer().broadcastSpaceUpdate(spaceId)`

2. **Data Model Transformation**
   - PostgreSQL's nested JSON → Turso's normalized tables
   - Handled automatically by `TursoDatabase` class
   - Benefits: SQL JOINs for counting, individual node updates, better indexing

3. **Connection Management**
   - Matches existing pattern: create/close per request
   - Works with both local file and remote Turso
   - SQLite handles concurrency for local files

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
1. **OpenAI Embeddings API** - `text-embedding-3-small` (configurable dims) - *Current implementation*
2. **Serverless GPU (Future)** - Self-hosted models on rental GPU (Modal, RunPod, etc.) for privacy
3. **Transformers.js** - Run in Node.js/browser (e.g., `all-MiniLM-L6-v2`)
4. **External service** - Cohere, Voyage AI, Hugging Face Inference API

**Current Implementation:** OpenAI for simplicity and rapid prototyping.

**Future Migration (Privacy-focused):** Serverless GPU approach
- Deploy embedding model (e.g., `sentence-transformers/all-MiniLM-L6-v2`) to rental GPU
- Client sends batch of texts to serverless endpoint
- GPU computes embeddings and returns Float32Array vectors
- Client stores embeddings in Turso
- Benefits: Full data privacy, cost control, model customization

**Key Insight:** Turso is **completely provider-agnostic** - it only requires Float32Array vectors of consistent dimensionality. The embedding source doesn't matter as long as dimensions match the schema (F32_BLOB(768)).

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

### ~~Immediate (Phase 1)~~ - ✅ ALL COMPLETED
1. ✅ Install `@libsql/client` package
2. ✅ Create `src/lib/turso-database.ts` with core interface
3. ✅ Create schema initialization script (`scripts/init-turso-schema.sql`)
4. ✅ Implement all 5 core methods with test coverage
5. ✅ Add environment variable configuration
6. ✅ Test with local file database first
7. ✅ Update API routes to trigger WebSocket broadcasts after writes (update-then-reload pattern)
8. ✅ Update WebSocket server to use database factory

### ~~Phase 2 Tasks~~ - ✅ ALL COMPLETED
1. ✅ Design node-level embedding schema
2. ✅ Add vector search methods to `TursoDatabase`
3. ✅ Integrate embedding generation (OpenAI/Transformers.js)
4. ✅ Create API endpoints for semantic search
5. ⏳ Add UI for semantic search in dashboard (future enhancement)
6. ⏳ Benchmark query performance vs PostgreSQL (future enhancement)
7. ⏳ Optimize with embedded replicas for edge deployment (future enhancement)

### Phase 3: Claude Code Integration - ✅ COMPLETED

**Implementation Date:** November 2025

**Problem Solved**: Created a comprehensive CLI tool that enables Claude Code to interact with cognitive spaces autonomously without requiring multiple permission approvals. Claude can now be an **active cognitive modeling participant**.

**Key Achievement**: Claude can "think with" the space - read holistically, understand relationships, and contribute intelligently to evolving thought structures.

**Implementation:**
- **CLI Tool**: [`scripts/space-cli.ts`](../scripts/space-cli.ts)
- **Framework**: Commander.js for clean command parsing
- **Output**: Concise JSON (machine-readable) with optional `--debug` mode
- **Backend Agnostic**: Works with both PostgreSQL and Turso

**All Requirements Met:**

#### 1. ✅ Holistic Reading Capabilities
- ✅ `get <spaceId>` - Complete space structure with all nodes, relationships, meanings, values
- ✅ `get <spaceId> --nodes-only` - Just the nodes for focused analysis
- ✅ `analyze <spaceId>` - Structured summary of focus levels, relationships, branching
- ✅ JSON output for easy parsing and reasoning

#### 2. ✅ Flexible Query Interface
- ✅ Simple commands for common patterns (list, get, analyze)
- ✅ Structured node queries via analyze command
- ✅ Raw JSON patch support for advanced use cases
- ✅ All output in JSON format

#### 3. ✅ Incremental Writing Operations
- ✅ `create <title> [description]` - Create spaces
- ✅ `add-node` - Add nodes with meanings, values, relationships
- ✅ `update-node` - Update nodes incrementally (PATCH semantics)
- ✅ `--checkable` and `--regular` - Manage lists
- ✅ `-f, --focus` - Set focus levels
- ✅ `-p, --position` - Adjust semantic positions
- ✅ `-r, --relates-to` - Add relationships

#### 4. ✅ Conversational Intelligence Support
- ✅ Get full context before responding (`get`, `analyze`)
- ✅ Reference nodes by name (node IDs in all operations)
- ✅ Add nodes based on tensions (`add-node` with relationships)
- ✅ Update focus as conversation evolves (`update-node --focus`)
- ✅ Analyze hidden vs visible nodes (`analyze` shows focus levels)

#### 5. ✅ Vector Search Integration
- ✅ `search <query>` - Find related concepts across all spaces
- ✅ `search-nodes <query> --space <id>` - Discover similar nodes
- ✅ Returns similarity scores for connection suggestions

**Complete Documentation**: [`docs/claude-code-cli-guide.md`](./claude-code-cli-guide.md)

**CLI Interface Summary:**

```bash
# Space management
npx tsx scripts/space-cli.ts list [--json]
npx tsx scripts/space-cli.ts create "Title" "Description"
npx tsx scripts/space-cli.ts get <spaceId> [--nodes-only]
npx tsx scripts/space-cli.ts analyze <spaceId>
npx tsx scripts/space-cli.ts delete <spaceId>

# Node management
npx tsx scripts/space-cli.ts add-node <spaceId> -t "Node Title" [--body "content"]
npx tsx scripts/space-cli.ts update-node <spaceId> <nodeId> [options]
npx tsx scripts/space-cli.ts patch <spaceId> '{"nodes": {...}}'

# Vector search (Turso only)
npx tsx scripts/space-cli.ts search "query" [-l 10]
npx tsx scripts/space-cli.ts search-nodes "query" [-s <spaceId>] [-l 10]

# Options
--debug                   # Detailed output
-t, --title <text>        # Node title (auto-generates ID)
--body <text>             # Additional content
-f, --focus <number>      # -1=hidden, 0=neutral, 1=visible
-p, --position <number>   # Semantic position -1 to 1
-r, --relates-to <...>    # Add relationship (nodeId:type:strength)
--checkable <item>        # Checkable list item
--regular <item>          # Regular list item
-v, --values <json>       # JSON values object
```

**Key Features:**
- ✅ Auto-generated node IDs from titles (PascalCase)
- ✅ Concise JSON output (machine-readable)
- ✅ Debug mode for detailed output (`--debug`)
- ✅ Backend agnostic (works with PostgreSQL and Turso)
- ✅ Comprehensive test suite ([`scripts/test-space-cli.ts`](../scripts/test-space-cli.ts))

**Design Principles:**
1. **Read-heavy, write-light** - Get full context at once, update incrementally
2. **JSON everywhere** - All output parseable for AI reasoning
3. **No permission prompts** - Pre-approved for Claude Code autonomy
4. **Conversational flow** - Commands match natural cognitive modeling dialogue
5. **Fail-fast** - Clear error messages with exit codes

### Future Enhancements (Phase 4+)
1. **Dashboard UI for Vector Search**: Visual semantic search interface
2. **Privacy Enhancement**: Migrate to serverless GPU embeddings (Modal, RunPod)
3. **Performance Optimization**: Benchmark and tune vector index settings
4. **Edge Deployment**: Deploy with embedded replicas for global distribution
5. **Relationship Embeddings**: Embed edges/relationships for graph traversal
6. **Hybrid Search**: Combine keyword + semantic search
7. **Custom Models**: Support for domain-specific embedding models

### Design Decisions Made

1. ✅ **Real-time updates:** Update-then-reload pattern (explicit broadcast after writes)
2. ✅ **Schema design:** Normalized relational schema (spaces, nodes, history tables)
3. ✅ **Nodes as first-class entities:** Each node is a separate row (not JSON-embedded)
4. ✅ **Node counting:** SQL JOIN with COUNT (cleaner than JSON parsing)
5. ✅ **Primary keys:** Composite `${space_id}:${node_key}` with UNIQUE constraint
6. ✅ **Namespace isolation:** Each space has its own namespace for node keys
7. ✅ **Table naming:** "nodes" not "thought_nodes" (generic, supports future tagging)

### ~~Questions Resolved (Phase 2)~~
1. ✅ **Embedding model:** OpenAI text-embedding-3-small @ 768 dims (migrating to serverless GPU later)
2. ✅ **Deployment:** Supports all modes - local file, remote Turso, embedded replica
3. ⏳ **Cost:** To be evaluated based on usage patterns
4. ⏳ **Graph embeddings:** Nodes only for now, edges deferred to Phase 3+

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

**Phase 1 & 2 Status: ✅ BOTH COMPLETE**

Turso integration is fully operational with advanced semantic search capabilities. The system now supports:

**Phase 1 - Core Capabilities:**
- ✅ Full CRUD operations on cognitive spaces
- ✅ Normalized relational schema for better querying
- ✅ Real-time WebSocket updates via update-then-reload pattern
- ✅ Local file, remote, and embedded replica support
- ✅ Complete interface compatibility between PostgreSQL and Turso backends
- ✅ Seamless switching via DATABASE_TYPE environment variable

**Phase 2 - Vector Search Capabilities:**
- ✅ 768-dimensional vector embeddings (F32_BLOB)
- ✅ Automatic embedding generation on space insert/update
- ✅ Semantic search across spaces by title/description
- ✅ Semantic search across all nodes or within specific spaces
- ✅ DiskANN-powered vector indices for fast similarity search
- ✅ RESTful API endpoints for semantic search
- ✅ Cosine similarity scoring with configurable thresholds
- ✅ OpenAI embeddings (preparing for serverless GPU migration)

**What's Next (Phase 3+):**
- Dashboard UI integration for semantic search
- Migration to serverless GPU for privacy-preserving embeddings
- Performance benchmarking and optimization
- Edge deployment with embedded replicas
- Relationship/edge embeddings for graph traversal
- Hybrid keyword + semantic search

The "code-as-gesture" philosophy of this project aligns well with Turso's lightweight, embeddable nature - cognitive spaces are now truly portable artifacts that can run anywhere from local SQLite files to globally distributed edge databases.
