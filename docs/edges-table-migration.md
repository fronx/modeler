# Edges Table Migration Plan

**⚠️ Important:** Use `@libsql/client` to query the database, not the `sqlite3` CLI (which may return incorrect results with Turso/libSQL databases).

## Why This Change?

### Current Limitations

**Storage approach**: Edges are embedded in node JSON as `relationships: [{ type, target, strength }]`

This works for simple cognitive modeling but breaks down for graph analytics:

1. **Can't query edges**: "Find all nodes that support X" requires parsing all node JSON
2. **No referential integrity**: Deleting a node leaves orphaned edges pointing to it
3. **Poor performance**: Building adjacency matrices requires loading entire spaces
4. **Limited analytics**: Can't efficiently compute clustering, centrality, or suggestions

### Enabling Semantic Flow Analysis

The [`dropinapond`](/Users/fnx/code/justin/dropinapond) project demonstrates powerful graph analytics we want to port (see [`src/semantic_flow.py`](/Users/fnx/code/justin/dropinapond/src/semantic_flow.py) and [`src/flow_analysis/`](/Users/fnx/code/justin/dropinapond/src/flow_analysis/)):

**What we can't do now:**
- Blend structural topology with semantic embeddings
- Compute predictability fields (F, D, F_MB, E_MB)
- Detect semantic clusters via modularity maximization
- Generate edge suggestions based on phrase affinity
- Analyze Markov blanket coupling between concepts

**What edges table enables:**
- Efficient adjacency matrix construction (S matrix)
- Query incoming/outgoing edges for any node
- Filter edges by type/strength for different analyses
- Join edges with node embeddings for semantic-structural blending

### Cognitive Coherence

From a modeling perspective, relationships are **first-class cognitive objects**, not mere properties:
- Edges have their own semantics (support vs conflict)
- Edges have strength that can be queried and analyzed
- Graph structure reveals emergent conceptual organization
- Relationship patterns are as important as node meanings

## Problem Statement

Currently, edges (relationships between nodes) are stored as JSON arrays within node data:
- **Current**: `nodes.data` contains `{ relationships: [{ type, target, strength }] }`
- **Issue**: Can't query edges directly, no cascade cleanup, orphaned edges when targets deleted

## Goals

1. **First-class edges**: Separate `edges` table for efficient querying
2. **Data consistency**: No orphaned edges via foreign keys + cascade deletes
3. **Graph analytics**: Enable semantic flow analysis (matrices, clustering, suggestions)
4. **Backward compatibility**: Migrate existing data without loss

---

## Current Orphan Edge Problem

**What happens now when a node is deleted:**

```typescript
// src/app/api/spaces/[spaceId]/thoughts/[nodeId]/route.ts
DELETE /api/spaces/{spaceId}/thoughts/{nodeId}
  → db.deleteNode(spaceId, nodeId)
  → DELETE FROM nodes WHERE id = ?
```

**Problem**: If node B is deleted, node A's relationship `A → B` becomes orphaned:
- Node A still has `{ relationships: [{ target: "B", ... }] }` in its JSON
- No database constraint prevents this
- UI will try to render edge to non-existent node
- Graph analysis will fail or produce incorrect results

**Current workarounds:**
- UI filters out edges to missing nodes (defensive programming)
- No automatic cleanup of orphaned relationships

---

## Proposed Schema

```sql
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,              -- Generated: "${spaceId}:${sourceNode}:${targetNode}"
  space_id TEXT NOT NULL,
  source_node TEXT NOT NULL,        -- Node key (e.g., "Trust")
  target_node TEXT NOT NULL,        -- Node key (e.g., "Evidence")
  type TEXT NOT NULL,               -- 'supports' | 'conflicts-with' | 'relates-to'
  strength REAL NOT NULL,           -- 0.0 to 1.0
  gloss TEXT,                       -- Optional description
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(space_id, source_node, target_node),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id, source_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE,
  FOREIGN KEY (space_id, target_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE
);

CREATE INDEX edges_space_source_idx ON edges(space_id, source_node);
CREATE INDEX edges_space_target_idx ON edges(space_id, target_node);
CREATE INDEX edges_type_idx ON edges(space_id, type);
```

**Key constraints:**

1. `UNIQUE(space_id, source_node, target_node)` - No duplicate edges
2. `ON DELETE CASCADE` - Auto-cleanup when nodes deleted
3. Composite foreign keys ensure both source and target exist

---

## Data Consistency Strategy

### Cascade Delete Behavior

**When a space is deleted:**
```
DELETE FROM spaces WHERE id = ?
  ↓ (CASCADE)
  ├─ DELETE FROM nodes WHERE space_id = ?
  └─ DELETE FROM edges WHERE space_id = ?
```

**When a node is deleted:**
```
DELETE FROM nodes WHERE space_id = ? AND node_key = ?
  ↓ (CASCADE)
  ├─ DELETE FROM edges WHERE space_id = ? AND source_node = ?  (outgoing)
  └─ DELETE FROM edges WHERE space_id = ? AND target_node = ?   (incoming)
```

### Edge Write Operations

**Adding an edge:**
```sql
INSERT INTO edges (id, space_id, source_node, target_node, type, strength, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(space_id, source_node, target_node) DO UPDATE SET
  type = excluded.type,
  strength = excluded.strength,
  gloss = excluded.gloss,
  updated_at = excluded.updated_at
```

**Foreign key violations:**
- If source or target node doesn't exist → Insert fails immediately
- Transaction atomicity ensures consistency

### Orphan Prevention

**Database level:**
- Foreign key constraints prevent orphans at write time
- Cascade deletes clean up automatically

**Application level:**
- Add validation before edge creation (both nodes must exist)
- Atomic transactions for node+edge operations

---

## Migration Strategy

We use **incremental SQL migrations** via our existing migration system (`scripts/run-migration.ts`). This is the standard approach for Turso/libSQL schema changes and matches how we added the sessions table.

### Why Incremental Migrations?

**Advantages over recreating schema**:
1. **Works on live databases** - No need to dump/restore data
2. **Non-destructive** - Existing tables and data untouched
3. **Reversible** - Can rollback schema changes if needed
4. **Testable** - Can test on local database before remote
5. **Standard practice** - Matches how Prisma, Drizzle, Atlas work
6. **Version controlled** - Migration files tracked in git
7. **Auditable** - Clear history of schema changes

**Turso/libSQL support**:
- Full `ALTER TABLE` support for adding columns, indexes
- `CREATE TABLE IF NOT EXISTS` for idempotent migrations
- Transaction-based execution with automatic rollback on failure
- Works identically on local and remote databases

### Migration System Overview

**Migration runner**: `scripts/run-migration.ts`
- Executes SQL files from `scripts/migrations/`
- Splits statements by semicolons
- Runs on both local and remote databases
- Transaction-based (rollback on failure)

**Example usage**:
```bash
npx tsx scripts/run-migration.ts 002-add-edges-table.sql
```

### Phase 1: Schema Migration (SQL)

**File**: `scripts/migrations/002-add-edges-table.sql`

```sql
-- Add edges table with foreign key constraints
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  source_node TEXT NOT NULL,
  target_node TEXT NOT NULL,
  type TEXT NOT NULL,
  strength REAL NOT NULL,
  gloss TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(space_id, source_node, target_node),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id, source_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE,
  FOREIGN KEY (space_id, target_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE
);

CREATE INDEX edges_space_source_idx ON edges(space_id, source_node);
CREATE INDEX edges_space_target_idx ON edges(space_id, target_node);
CREATE INDEX edges_type_idx ON edges(space_id, type);
```

**Run migration**:
```bash
# Local database
npx tsx scripts/run-migration.ts 002-add-edges-table.sql

# Remote Turso database (automatically uses TURSO_DATABASE_URL)
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/run-migration.ts 002-add-edges-table.sql
```

### Phase 2: Data Migration (TypeScript)

**File**: `scripts/migrate-edges-data.ts`

Populate edges table from existing node JSON relationships:
```typescript
// For each space:
//   For each node with relationships:
//     For each relationship in node.data.relationships:
//       INSERT INTO edges (...)
```

**Keep node.relationships in JSON** (read-only, for rollback safety)

**Dual-read mode**: Application reads from edges table, falls back to JSON

### Phase 3: Application Updates

1. **Update database operations**:
   - `insertSpace()` - Write edges to edges table
   - `getSpace()` - Join edges and reconstruct graph
   - `deleteNode()` - Rely on CASCADE (no manual cleanup needed)
   - Add `insertEdge()`, `deleteEdge()`, `listEdges()`

2. **Update API endpoints**:
   - `POST /api/spaces/{spaceId}/edges` - Create edge
   - `GET /api/spaces/{spaceId}/edges` - List all edges for space
   - `DELETE /api/spaces/{spaceId}/edges/{edgeId}` - Delete edge

3. **Update UI components**:
   - Read edges from separate API call
   - Handle edge CRUD independently from nodes

### Phase 4: Deprecate JSON Relationships

1. **Stop writing** to `node.data.relationships`
2. **Remove from schema** after validation period
3. **Simplify node data structure**

### Phase 5: Add Graph Analytics

1. Port semantic flow analysis from `dropinapond`:
   - Build adjacency matrices efficiently
   - Compute predictability fields
   - Detect clusters
   - Generate edge suggestions

---

## Implementation Checklist

### Phase 1: Schema Migration

- [ ] Create `scripts/migrations/002-add-edges-table.sql`
- [ ] Test migration on local database
- [ ] Run migration on local database
- [ ] Run migration on remote Turso database
- [ ] Verify edges table created with correct constraints
- [ ] Add edges table to `scripts/init-turso-schema.sql` (for new installations)

### Phase 2: Data Migration

- [ ] Create `scripts/migrate-edges-data.ts` to populate edges from node JSON
- [ ] Test data migration on local database
- [ ] Run data migration on local database
- [ ] Run data migration on remote Turso database
- [ ] Verify all existing relationships migrated correctly
- [ ] Verify no orphaned edges created

### Phase 3: Database Layer Updates

- [ ] Update `TursoDatabase.insertSpace()` to write edges to edges table
- [ ] Update `TursoDatabase.getSpace()` to load edges from edges table
- [ ] Add `TursoDatabase.insertEdge()`
- [ ] Add `TursoDatabase.deleteEdge()`
- [ ] Add `TursoDatabase.listEdges(spaceId)`
- [ ] Implement dual-read mode (edges table + JSON fallback)
- [ ] Test cascade deletes for nodes
- [ ] Test cascade deletes for spaces
- [ ] Test foreign key violation handling

### API Layer

- [ ] Create `src/app/api/spaces/[spaceId]/edges/route.ts` (GET, POST)
- [ ] Create `src/app/api/spaces/[spaceId]/edges/[edgeId]/route.ts` (DELETE, PUT)
- [ ] Update `/api/chat/execute/route.ts` to use edges table
- [ ] Add validation for edge creation (both nodes exist)

### UI Layer

- [ ] Update `useCognitiveData` to load edges separately
- [ ] Update `ThoughtGraph` to read from edges data
- [ ] Add edge creation UI (optional - chat handles this)
- [ ] Add edge deletion UI (optional)
- [ ] Handle edge loading states

### Testing

- [ ] Test node deletion cleans up outgoing edges
- [ ] Test node deletion cleans up incoming edges
- [ ] Test space deletion cleans up all edges
- [ ] Test edge creation fails if nodes don't exist
- [ ] Test duplicate edge handling (UNIQUE constraint)
- [ ] Test migration script on real data
- [ ] Test rollback scenario (read from JSON fallback)

### Analytics (Future)

- [ ] Add endpoint to fetch edges as adjacency matrix
- [ ] Port semantic flow analysis functions
- [ ] Add clustering detection
- [ ] Add edge suggestion algorithm

---

## Rollback Plan

The incremental migration approach provides multiple safety mechanisms:

### Schema Rollback (if needed before data migration)

Since we use `CREATE TABLE IF NOT EXISTS`, the schema migration is idempotent and can be re-run safely. If the edges table needs to be dropped:

```sql
-- Emergency rollback: Drop edges table
DROP TABLE IF EXISTS edges;
```

**Note**: Only do this BEFORE data migration and application updates. Once the application writes to the edges table, dropping it would cause data loss.

### Application Rollback

If migration causes issues after application updates:

1. **Dual-read is active** - Application can still read from `node.data.relationships`
2. **Disable edges table writes** - Revert application code to write only to JSON
3. **Data preserved** - JSON relationships remain intact during entire migration
4. **Investigate issues** without data loss
5. **Re-enable** after fixes

### Safety Properties

- **Schema migration**: Non-destructive, only adds table (doesn't modify existing tables)
- **Data migration**: Doesn't modify or delete node JSON, only reads it
- **Dual-read period**: Application can read from both sources
- **Gradual cutover**: Can pause at any phase to validate

---

## Open Questions

1. **Performance**: How many edges per space? (Estimate: 50-200 for typical cognitive spaces)
2. **Sync strategy**: Should edge writes trigger immediate sync like node writes?
3. **Versioning**: Track edge history? (Probably not needed initially)
4. **Bidirectional edges**: Store both A→B and B→A, or compute reverse on read?
   - **Recommendation**: Store directed only, compute reverse via indexes
5. **Edge types extensibility**: Allow custom types or keep enum strict?
   - **Recommendation**: Start strict, add extensibility later if needed

---

## Success Metrics

- ✅ Zero orphaned edges in production
- ✅ Graph analytics queries run in <100ms for typical spaces
- ✅ Node deletion automatically cleans up all edges
- ✅ No data loss during migration
- ✅ UI correctly renders all edges from edges table
