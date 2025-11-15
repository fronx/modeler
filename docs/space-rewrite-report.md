# Database Update Patterns Audit Report

## 1. Database Write Methods Inventory

### Table: Write Methods in `src/lib/turso-database.ts`

| Method                    | Granularity            | What It Does                                                                                                                                        | Lines     |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `insertSpace()`           | **Full Space Rewrite** | Deletes ALL nodes, edges, and history for a space, then inserts entire space from scratch. Uses batch transaction. Generates embeddings if enabled. | 244-403   |
| `upsertNode()`            | **Granular Update**    | Inserts or updates a single node and its edges. Deletes existing edges for that node, then inserts new ones. Generates embeddings if enabled.       | 549-627   |
| `deleteSpace()`           | **Full Space Delete**  | Deletes entire space (cascades to nodes, edges, history via foreign keys).                                                                          | 510-522   |
| `deleteNode()`            | **Granular Update**    | Deletes a single node by ID (cascades to edges via foreign keys).                                                                                   | 524-543   |
| `updateSpaceEmbeddings()` | **Granular Update**    | Updates only title and description embeddings for a space.                                                                                          | 637-660   |
| `saveSession()`           | **Granular Update**    | Inserts or updates a single Claude CLI session record.                                                                                              | 1100-1132 |
| `touchSession()`          | **Granular Update**    | Updates session timestamp and message count.                                                                                                        | 1137-1152 |
| `deleteSession()`         | **Granular Update**    | Deletes a single session.                                                                                                                           | 1186-1198 |
| `insertEdge()`            | **Granular Update**    | Inserts or updates a single edge between two nodes.                                                                                                 | 1207-1245 |
| `deleteEdge()`            | **Granular Update**    | Deletes a single edge by ID.                                                                                                                        | 1278-1290 |

## 2. API Route Usage Audit

### Routes Doing **FULL SPACE REWRITES** (Problems Identified)

| Route                                      | Method        | Database Call                   | Current Behavior                                         | Problem Severity                                              |
| ------------------------------------------ | ------------- | ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| `api/spaces/route.ts`                      | POST          | `saveSpace()` → `insertSpace()` | Creates new empty space                                  | ✅ **LEGITIMATE** - Creating new space                         |
| `api/spaces/route.ts`                      | PUT           | `saveSpace()` → `insertSpace()` | Replaces entire space from JSON                          | ✅ **LEGITIMATE** - Full JSON import                           |
| `api/spaces/[spaceId]/route.ts`            | PUT           | `saveSpace()` → `insertSpace()` | Replaces entire space, processes node meanings           | ✅ **LEGITIMATE** - Full JSON import                           |
| `api/spaces/[spaceId]/route.ts`            | PATCH         | `saveSpace()` → `insertSpace()` | Fetches space, modifies in memory, rewrites entire space | 🔴 **HIGH PRIORITY** - Should use granular updates             |
| `api/spaces/[spaceId]/check-item/route.ts` | POST          | `saveSpace()` → `insertSpace()` | Fetches space, toggles checkbox, rewrites entire space   | 🔴 **HIGH PRIORITY** - Should update single node               |
| `api/chat/execute/route.ts`                | POST          | `db.insertSpace()`              | Processes batch changes, rewrites entire space           | 🔴 **HIGH PRIORITY** - Should use granular updates             |
| `scripts/space-cli.ts`                     | `add-node`    | `db.insertSpace()`              | Adds node to space in memory, rewrites entire space      | 🟡 **MEDIUM** - CLI tool, less critical but should be granular |
| `scripts/space-cli.ts`                     | `update-node` | `db.insertSpace()`              | Updates node in memory, rewrites entire space            | 🟡 **MEDIUM** - CLI tool, less critical                        |
| `scripts/space-cli.ts`                     | `patch`       | `db.insertSpace()`              | Applies JSON patch, rewrites entire space                | 🟡 **MEDIUM** - Could be granular for node patches             |

### Routes Using **GRANULAR UPDATES** (Correct)

| Route                                             | Method | Database Call        | Behavior                   |
| ------------------------------------------------- | ------ | -------------------- | -------------------------- |
| `api/spaces/[spaceId]/thoughts/route.ts`          | POST   | `db().upsertNode()`  | ✅ Adds/updates single node |
| `api/spaces/[spaceId]/thoughts/[nodeId]/route.ts` | DELETE | `db().deleteNode()`  | ✅ Deletes single node      |
| `api/spaces/[spaceId]/edges/route.ts`             | POST   | `db().insertEdge()`  | ✅ Adds/updates single edge |
| `api/spaces/[spaceId]/edges/[edgeId]/route.ts`    | DELETE | `db().deleteEdge()`  | ✅ Deletes single edge      |
| `api/spaces/[spaceId]/edges/[edgeId]/route.ts`    | PUT    | `db().insertEdge()`  | ✅ Updates single edge      |
| `api/spaces/[spaceId]/route.ts`                   | DELETE | `db().deleteSpace()` | ✅ Deletes entire space     |

### Routes That Are **READ-ONLY** (No Changes Needed)

- `api/spaces/route.ts` (GET)
- `api/spaces/[spaceId]/route.ts` (GET)
- `api/spaces/[spaceId]/thoughts/route.ts` (GET)
- `api/spaces/[spaceId]/edges/route.ts` (GET)
- `api/spaces/[spaceId]/thoughts-direct/route.ts` (GET)
- `api/search/spaces/route.ts`
- `api/search/nodes/route.ts`
- All other routes

## 3. Missing Granular Methods

The following granular update methods should be added to `TursoDatabase`:

| Recommended Method                                              | Purpose                                               | Priority                              |
| --------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `updateSpaceMetadata(spaceId, {title?, description?})`          | Update space title/description without touching nodes | 🔴 **HIGH**                            |
| `appendGlobalHistory(spaceId, entry)`                           | Add single history entry without rewriting space      | 🔴 **HIGH**                            |
| `updateNodeField(spaceId, nodeKey, field, value)`               | Update specific node field (e.g., checkableList)      | 🔴 **HIGH**                            |
| `patchNode(spaceId, nodeKey, partialUpdate)`                    | Merge partial updates into node without full replace  | 🟡 **MEDIUM**                          |
| `bulkUpsertNodes(spaceId, nodes[])`                             | Batch update multiple nodes efficiently               | 🟡 **MEDIUM**                          |
| `updateNodeCheckableItem(spaceId, nodeKey, itemIndex, checked)` | Ultra-granular: update single checkbox                | 🟢 **LOW** - Can use `updateNodeField` |

## 4. Specific Refactoring Recommendations

### Priority 1: HIGH (Fix Immediately)

#### 4.1 `api/spaces/[spaceId]/check-item/route.ts`
**Current**: Fetches entire space → modifies checkbox → rewrites entire space  
**Recommended**: Add `updateNodeField()` method or use direct SQL

```typescript
// NEW METHOD in TursoDatabase:
async updateNodeField(spaceId: string, nodeKey: string, field: string, value: any): Promise<void> {
  const space = await this.getSpace(spaceId);
  if (!space?.nodes[nodeKey]) throw new Error('Node not found');
  
  const node = { ...space.nodes[nodeKey], [field]: value };
  await this.upsertNode(spaceId, nodeKey, node);
}

// IN ROUTE:
await db().updateNodeField(spaceId, nodeId, 'checkableList', updatedCheckableList);
```

#### 4.2 `api/spaces/[spaceId]/route.ts` - PATCH method
**Current**: Fetches space → modifies metadata/nodes in memory → rewrites entire space  
**Recommended**: Split into granular operations

```typescript
// For metadata updates: NEW updateSpaceMetadata() method
// For node updates: Use existing upsertNode()
// For history: NEW appendGlobalHistory() method

// NEW METHODS in TursoDatabase:
async updateSpaceMetadata(spaceId: string, updates: { title?: string; description?: string }): Promise<void> {
  const setClause = [];
  const args = [];
  
  if (updates.title) {
    setClause.push('title = ?');
    args.push(updates.title);
  }
  if (updates.description) {
    setClause.push('description = ?');
    args.push(updates.description);
  }
  
  if (setClause.length === 0) return;
  
  setClause.push('updated_at = ?');
  args.push(Date.now());
  args.push(spaceId);
  
  await this.client.execute({
    sql: `UPDATE spaces SET ${setClause.join(', ')} WHERE id = ?`,
    args
  });
  
  await this.syncAfterWrite();
}

async appendGlobalHistory(spaceId: string, entry: string): Promise<void> {
  const now = Date.now();
  await this.client.execute({
    sql: `INSERT INTO history (id, space_id, entry, created_at) VALUES (?, ?, ?, ?)`,
    args: [`${spaceId}:${now}`, spaceId, entry, now]
  });
  await this.syncAfterWrite();
}
```

#### 4.3 `api/chat/execute/route.ts`
**Current**: Accumulates changes in memory → rewrites entire space  
**Recommended**: Use granular operations for each change

```typescript
// For add_node: Use existing upsertNode()
// For add_relationship: Update via upsertNode() or create updateNodeRelationships()

// Option 1: Update node with new relationship
const node = existingSpace.nodes[sourceNode];
node.relationships.push({ type, target: targetNode, strength });
await db().upsertNode(spaceId, sourceNode, node);

// Option 2: NEW METHOD for just relationships
async addRelationship(spaceId: string, sourceNode: string, targetNode: string, type: string, strength: number): Promise<void> {
  // First add to edges table
  await this.insertEdge({ spaceId, sourceNode, targetNode, type, strength });
  
  // Note: Edges are now canonical source, relationships in node data are derived
  // So this might just be insertEdge()!
}
```

### Priority 2: MEDIUM (Improve CLI Tools)

#### 4.4 `scripts/space-cli.ts` - `add-node` and `update-node` commands
**Current**: Uses `db.insertSpace()` for all node operations  
**Recommended**: Use `upsertNode()` + `appendGlobalHistory()`

```typescript
// Replace all db.insertSpace(space) with:
await db.upsertNode(space.metadata.id, nodeId, newNode);
await db.appendGlobalHistory(space.metadata.id, `Node added: ${nodeId}`);
```

### Priority 3: LOW (Nice to Have)

#### 4.5 Batch Operations
For `chat/execute` with multiple changes, consider adding:

```typescript
async batchUpsertNodes(spaceId: string, nodes: Record<string, any>): Promise<void> {
  const statements = [];
  for (const [nodeKey, nodeData] of Object.entries(nodes)) {
    // Build batch statements similar to upsertNode
  }
  await this.client.batch(statements, 'write');
  await this.syncAfterWrite();
}
```

## 5. Legitimate Full-Space Write Scenarios

These scenarios SHOULD continue using `insertSpace()`:

1. **Creating a new space** - `POST /api/spaces`
2. **Importing full space from JSON file** - `PUT /api/spaces?id=X` or `PUT /api/spaces/[spaceId]`
3. **CLI `create` command** - Creating new space
4. **Migration scripts** - Bulk data import
5. **Restoring from backup** - Full space restoration

## Summary Statistics

- **Total write methods**: 10
- **Granular methods**: 8 (80%)
- **Full-space methods**: 1 (10%) + 1 delete (10%)
- **API routes using full-space rewrites unnecessarily**: 3 (HIGH priority)
- **CLI commands using full-space rewrites**: 3 (MEDIUM priority)
- **Routes already using granular updates correctly**: 5 ✅
- **New methods recommended**: 4 (HIGH: 2, MEDIUM: 2)

## Implementation Order

1. Add `updateSpaceMetadata()` and `appendGlobalHistory()` to TursoDatabase
2. Refactor `PATCH /api/spaces/[spaceId]` to use new methods
3. Add `updateNodeField()` to TursoDatabase
4. Refactor `POST /api/spaces/[spaceId]/check-item` to use new method
5. Refactor `POST /api/chat/execute` to use `upsertNode()` instead of `insertSpace()`
6. Update CLI tools to use granular methods
7. Consider adding `batchUpsertNodes()` for multi-node updates