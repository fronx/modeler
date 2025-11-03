# Embedded Replicas with Turso

This document explains how to use Turso's embedded replicas feature for cloud syncing in the Modeler application.

## What Are Embedded Replicas?

Embedded replicas create a local SQLite database file that automatically syncs with a remote Turso database. This provides:

- **Fast local reads** - Microsecond-level read operations from local file
- **Automatic cloud backup** - All writes sync to remote database
- **Offline capability** - Continue reading data without internet connection
- **Read-your-writes consistency** - Writes automatically update local replica

## How It Works

```
┌─────────────────┐
│  Your App       │
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
┌─────────┐              ┌─────────┐
│ Local   │    Sync      │ Remote  │
│ Replica │◄────────────►│ Turso   │
│ (file)  │              │ (cloud) │
└─────────┘              └─────────┘
   Fast reads          Writes + Backup
```

- **Reads**: Served from local file (microseconds)
- **Writes**: Go to remote database, then sync back to local file
- **Sync**: Manual via `sync()` or automatic at intervals

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Local database file path
TURSO_DATABASE_URL=file:modeler.db

# Remote Turso database to sync with
TURSO_SYNC_URL=https://your-database.turso.io

# Authentication token
TURSO_AUTH_TOKEN=your-auth-token

# Optional: Auto-sync interval in seconds (0 = disabled)
TURSO_SYNC_INTERVAL=60
```

### Getting Your Turso Credentials

```bash
# Install Turso CLI
brew install tursodatabase/tap/turso

# Login
turso auth login

# Create a database
turso db create modeler

# Get the database URL
turso db show modeler --url

# Create an auth token
turso db tokens create modeler
```

## Usage

### Basic Setup

```typescript
import { TursoDatabase } from './lib/turso-database';

// Create database with embedded replica
const db = new TursoDatabase({
  url: 'file:modeler.db',
  syncUrl: 'https://your-database.turso.io',
  authToken: 'your-auth-token',
  syncInterval: 60  // Auto-sync every 60 seconds
});
```

### Manual Syncing

```typescript
// Trigger a manual sync
await db.sync();

// Check sync status
const stats = db.getSyncStats();
console.log('Last synced:', new Date(stats.lastSyncedAt!));
console.log('Sync count:', stats.syncCount);
console.log('Currently syncing:', stats.isSyncing);
```

### Automatic Syncing

Automatic syncing starts when you provide a `syncInterval`:

```typescript
// Auto-sync every 30 seconds
const db = new TursoDatabase({
  syncInterval: 30
});

// Stop auto-sync if needed
db.stopAutoSync();
```

### Checking Replica Status

```typescript
// Check if using embedded replica
if (db.isReplica()) {
  console.log('Using embedded replica with cloud sync');
} else {
  console.log('Using direct remote connection');
}
```

## Best Practices

### When to Use Embedded Replicas

✅ **Good for:**
- Desktop applications (like Modeler)
- VMs and VPS deployments
- Applications with heavy read workloads
- Scenarios requiring offline capability

❌ **Not for:**
- Serverless environments (no filesystem)
- Ephemeral containers
- Multiple concurrent writers to same local file

### Sync Strategies

**High-frequency writes:**
```typescript
// Short interval for real-time sync
syncInterval: 10  // 10 seconds
```

**Occasional writes:**
```typescript
// Longer interval or manual sync
syncInterval: 300  // 5 minutes

// Or manual sync after writes
await db.insertSpace(space);
await db.sync();
```

**Background applications:**
```typescript
// Auto-sync with error handling
const db = new TursoDatabase({ syncInterval: 60 });

// Monitor sync status
setInterval(() => {
  const stats = db.getSyncStats();
  if (stats.lastError) {
    console.error('Sync error:', stats.lastError);
  }
}, 30000);
```

### Error Handling

```typescript
try {
  await db.sync();
} catch (error) {
  console.error('Sync failed:', error);
  // Local data is still available for reads
  // Writes will continue to attempt remote connection
}
```

## Migration Scenarios

### Scenario 1: Existing Local Database → New Remote Database

If you have an existing `modeler.db` with data and want to set up a new remote Turso database:

**⚠️ IMPORTANT: You must migrate your data BEFORE enabling embedded replicas!**

Otherwise, the first sync will overwrite your local data with the empty remote database.

```bash
# 1. Set up your .env with remote credentials
TURSO_SYNC_URL=https://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# 2. Run the migration script
npx tsx scripts/migrate-to-embedded-replica.ts

# 3. Verify the migration succeeded
# The script will show row counts for spaces, nodes, and history

# 4. Back up your local database
cp modeler.db modeler.db.backup

# 5. Enable embedded replica in .env
TURSO_DATABASE_URL=file:modeler.db
TURSO_SYNC_URL=https://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
TURSO_SYNC_INTERVAL=60

# 6. Restart your application
npm run dev
```

The migration script will:
- Initialize the remote database schema
- Copy all spaces, nodes, and history entries
- Verify row counts match
- Show you a summary

### Scenario 2: Existing Remote Database → Local Replica

If you're currently using a remote-only database and want to add a local replica:

```typescript
// Before (remote-only)
const db = new TursoDatabase({
  url: 'https://your-database.turso.io',
  authToken: 'your-auth-token'
});

// After (embedded replica)
const db = new TursoDatabase({
  url: 'file:modeler.db',
  syncUrl: 'https://your-database.turso.io',
  authToken: 'your-auth-token',
  syncInterval: 60
});
```

The first sync will download your entire remote database to the local file.

### Scenario 3: Fresh Start

If you're starting fresh with no existing data:

```bash
# Just configure embedded replica from the start
TURSO_DATABASE_URL=file:modeler.db
TURSO_SYNC_URL=https://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
TURSO_SYNC_INTERVAL=60
```

No migration needed!

## Monitoring and Debugging

### Sync Statistics

```typescript
const stats = db.getSyncStats();
console.log({
  lastSynced: stats.lastSyncedAt
    ? new Date(stats.lastSyncedAt).toISOString()
    : 'never',
  totalSyncs: stats.syncCount,
  syncing: stats.isSyncing,
  error: stats.lastError
});
```

### Console Output

The library logs sync operations:

```
Starting auto-sync every 60 seconds
Sync failed: [error details]
Auto-sync stopped
```

## Performance Considerations

- **First sync**: Downloads entire database (may take time for large databases)
- **Incremental syncs**: Only transfers changes (fast)
- **Local reads**: ~1μs (microseconds)
- **Remote writes**: ~50-200ms (depends on network)
- **Sync overhead**: 4KB minimum per write (SQLite page size)

## Limitations

⚠️ **Important constraints:**

1. **No concurrent access**: Never access the local database file during sync
2. **Filesystem required**: Not available in serverless environments
3. **Single writer**: Only one process should write to the local file
4. **Storage**: Each write consumes minimum 4KB (full SQLite page)

## Troubleshooting

### Sync fails with "file is locked"

Multiple processes are trying to access the database file. Ensure only one instance of your app is running.

### Auto-sync not working

Check that:
- `TURSO_SYNC_URL` is set correctly
- `TURSO_DATABASE_URL` starts with `file:`
- `TURSO_SYNC_INTERVAL` is > 0

### High storage usage

Embedded replicas store the full database locally. Monitor file size:

```bash
ls -lh modeler.db
```

## References

- [Turso Embedded Replicas Documentation](https://docs.turso.tech/features/embedded-replicas/introduction)
- [libSQL Client Documentation](https://docs.turso.tech/libsql/client-access)
- [Modeler Database Architecture](./DATABASE-ARCHITECTURE.md)
