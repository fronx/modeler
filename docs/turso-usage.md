# Turso Database Usage Guide

## Overview

The Modeler project now supports two database backends:
- **PostgreSQL** (default) - Original implementation with LISTEN/NOTIFY
- **Turso/libSQL** - New implementation with normalized schema and vector search capabilities (Phase 2)

## Quick Start

### Using Local File Database (Development)

The easiest way to get started is with a local SQLite file:

```bash
# Set environment variable
export DATABASE_TYPE=turso

# No other configuration needed - defaults to file:modeler.db
npm run dev
```

### Using Turso Cloud (Production)

1. Create a Turso database:
```bash
turso db create modeler-db
turso db show modeler-db
```

2. Get your auth token:
```bash
turso db tokens create modeler-db
```

3. Configure environment variables:
```bash
export DATABASE_TYPE=turso
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-auth-token"
```

4. Start the application:
```bash
npm run dev
```

### Using Embedded Replica (Best of Both Worlds)

Embedded replicas provide local-first performance with cloud sync:

```bash
export DATABASE_TYPE=turso
export TURSO_DATABASE_URL="file:local.db"
export TURSO_SYNC_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-auth-token"
```

The client will automatically sync local changes to the cloud.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_TYPE` | No | `postgres` | Database backend: `postgres` or `turso` |
| `TURSO_DATABASE_URL` | No | `file:modeler.db` | Database URL (file path or remote URL) |
| `TURSO_AUTH_TOKEN` | Conditional | - | Required for remote/replica mode |
| `TURSO_SYNC_URL` | No | - | Remote URL for embedded replica sync |

## Schema Design

### Normalized Relational Schema

Unlike PostgreSQL which stores everything as JSON, Turso uses a normalized schema:

**Spaces Table:**
```sql
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

**Nodes Table:**
```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,               -- ${space_id}:${node_key}
    space_id TEXT NOT NULL,
    node_key TEXT NOT NULL,            -- e.g., "DirectTransmission"
    data TEXT NOT NULL,                -- JSON: meanings, values, etc.
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(space_id, node_key)
);
```

**History Table:**
```sql
CREATE TABLE history (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    entry TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
```

### Benefits of Normalized Schema

1. **Efficient Queries**: Count nodes without parsing JSON
2. **Individual Updates**: Update single nodes without rewriting entire space
3. **Better Indexing**: Query nodes directly by space or timestamp
4. **Vector Ready**: Easy to add embedding columns in Phase 2

## Real-time Updates

### PostgreSQL Approach
Uses `LISTEN/NOTIFY` for automatic push notifications.

### Turso Approach
Uses "update-then-reload" pattern:
- After any write operation, API routes explicitly trigger WebSocket broadcasts
- `getThoughtWebSocketServer().broadcastSpaceUpdate(spaceId)`
- No polling required - updates are pushed immediately after writes

## Testing

Run the test script to verify Turso integration:

```bash
npx tsx test-turso.ts
```

This will:
1. Create a test space with nodes
2. Retrieve and verify data integrity
3. List all spaces
4. Update the space
5. Delete the space
6. Verify deletion

## Migration

### Migrating from PostgreSQL to Turso

A migration script is planned for future implementation. For now, you can:

1. Export spaces from PostgreSQL
2. Use the API to recreate them in Turso

### Data Model Differences

**PostgreSQL (denormalized):**
```json
{
  "id": "space-123",
  "title": "My Space",
  "data": {
    "nodes": { ... },
    "globalHistory": [ ... ]
  }
}
```

**Turso (normalized):**
- Space metadata in `spaces` table
- Each node as separate row in `nodes` table
- Each history entry as separate row in `history` table

The `TursoDatabase` class handles this transformation automatically.

## Performance Considerations

### Local File Mode
- Excellent read performance (SQLite is very fast)
- Write concurrency handled by SQLite's locking
- Perfect for development and single-user scenarios

### Remote Mode
- Network latency for each operation
- Turso's edge deployment minimizes latency
- Consider embedded replica for better performance

### Embedded Replica Mode
- Read from local file (instant)
- Writes go to local first, then sync to cloud
- Best performance with cloud backup

## Future: Vector Search (Phase 2)

Turso supports native vector embeddings. Phase 2 will add:

```sql
ALTER TABLE nodes ADD COLUMN title_embedding F32_BLOB(768);
ALTER TABLE nodes ADD COLUMN full_embedding F32_BLOB(768);
```

This will enable:
- Semantic search across spaces
- Find similar thought nodes
- Embed relationships for graph traversal
- AI-powered discovery of related concepts

See [turso-integration-plan.md](./turso-integration-plan.md) for full Phase 2 roadmap.

## Troubleshooting

### "No such table" error
The schema is automatically initialized on first use. If you see this error:
1. Ensure `scripts/init-turso-schema.sql` exists
2. Check file permissions
3. Verify `process.cwd()` points to project root

### WebSocket notifications not working
When using Turso, ensure:
1. API routes call `getThoughtWebSocketServer().broadcastSpaceUpdate(spaceId)` after writes
2. WebSocket server is running (check console for "ThoughtWebSocket server running")

### Auth token issues
For remote/replica mode:
1. Verify token is valid: `turso db tokens validate <token>`
2. Check token has correct permissions
3. Ensure `TURSO_AUTH_TOKEN` is set in environment

## Switching Between Backends

You can switch databases by changing `DATABASE_TYPE`:

```bash
# Use PostgreSQL
export DATABASE_TYPE=postgres
npm run dev

# Use Turso
export DATABASE_TYPE=turso
npm run dev
```

**Note**: The two databases are independent. Data is not automatically synced between them.

## API Compatibility

The `TursoDatabase` class implements the same interface as `Database`, ensuring complete API compatibility:

- `insertSpace(space)` - Create or update space
- `getSpace(id)` - Retrieve space by ID
- `listSpaces()` - List all spaces with metadata
- `deleteSpace(id)` - Delete space and all related data
- `close()` - Close database connection

All existing API routes work unchanged with both backends.
