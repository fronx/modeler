# Replicated Database Setup Guide

This guide explains how to set up and configure a replicated database for the Modeler application using Turso's embedded replicas feature with optimal performance settings.

## Overview

A replicated database setup combines:
- **Local SQLite database** - Fast reads/writes on your machine (`file:modeler.db`)
- **Remote Turso database** - Cloud backup and multi-device sync
- **Offline mode** - Instant local writes with background sync (critical for performance)

## Quick Start

### 1. Get Turso Credentials

```bash
# Install Turso CLI
brew install tursodatabase/tap/turso

# Login to Turso
turso auth login

# Create a database
turso db create modeler

# Get the sync URL
turso db show modeler --url
# Example output: https://modeler-your-org.turso.io

# Create an auth token
turso db tokens create modeler
# Example output: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

### 2. Configure Environment Variables

Create or update your `.env` file (see `.env.example`):

```bash
# Local database file (your fast local replica)
TURSO_DATABASE_URL=file:modeler.db

# Remote Turso database (cloud backup)
TURSO_SYNC_URL=https://modeler-your-org.turso.io

# Authentication token
TURSO_AUTH_TOKEN=esGhbHciO...

# Sync interval in seconds (60 = sync every minute)
TURSO_SYNC_INTERVAL=60

# OpenAI API key (for embeddings)
OPENAI_API_KEY=sk-...
```

### 3. Migrate Existing Data (If Applicable)

**⚠️ CRITICAL:** If you have existing data in `modeler.db`, you MUST migrate it to the remote database BEFORE enabling embedded replicas!

```bash
# Run the migration script
npx tsx scripts/migrate-to-embedded-replica.ts

# Verify the migration succeeded
# The script will show row counts for spaces, nodes, and history

# Back up your local database
cp modeler.db modeler.db.backup
```

### 4. Start Your Application

```bash
npm run dev
```

Your app will now use the replicated database with:
- **Instant local writes** (~1-2ms)
- **Background sync to cloud** (every 60 seconds)
- **Fast local reads** (microseconds)

## Performance: Why Offline Mode Matters

### The Problem (Commit 2de46de)

By default, embedded replicas wait for remote confirmation on every write:

```typescript
// DEFAULT BEHAVIOR (SLOW - DO NOT USE)
offline: false  // Every write blocks waiting for network
                // 3140ms for batch of 13 statements
                // insertSpace() takes ~12 seconds
```

**Performance Impact:**
- Network latency to AWS eu-west-1: ~190ms
- Batch of 13 statements: **3140ms** (with default settings)
- Real-world `insertSpace()` operation: **~12 seconds**

### The Solution (Enabled Automatically)

Our implementation **automatically enables `offline: true`** for all embedded replicas:

```typescript
// AUTOMATIC OPTIMIZATION (FAST)
offline: true   // Writes are local, sync in background
                // 1ms for batch of 13 statements
                // insertSpace() takes ~1 second
```

**Performance Improvement:**
- Batch of 13 statements: **1ms** (3140x faster!)
- Real-world `insertSpace()` operation: **~1 second** (12x faster)

See [turso-database.ts:76](../src/lib/turso-database.ts#L76) for the automatic offline mode detection.

## How It Works

### Architecture

```
┌─────────────────┐
│  Your App       │
└────────┬────────┘
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
┌─────────┐              ┌─────────┐
│ Local   │  Background  │ Remote  │
│ Replica │     Sync     │ Turso   │
│ (file)  │◄────────────►│ (cloud) │
└─────────┘              └─────────┘
  Instant writes      Eventual consistency
  (1-2ms)             (max 60s delay)
```

### Write Flow (offline: true)

1. **Application writes data** → Goes to local SQLite immediately
2. **Write completes in 1-2ms** → Your app continues without waiting
3. **Background sync runs** → Every 60 seconds (configurable)
4. **Remote database updated** → Other replicas see changes after next sync

### Read Flow

1. **Application reads data** → Always from local SQLite file
2. **Microsecond latency** → No network roundtrip
3. **"Read-your-writes" guarantee** → You always see your own latest writes

## Configuration Options

### Database Configuration

```typescript
import { TursoDatabase } from './lib/turso-database';

const db = new TursoDatabase({
  // Local database file (required for embedded replica)
  url: 'file:modeler.db',

  // Remote Turso database URL (required for sync)
  syncUrl: process.env.TURSO_SYNC_URL,

  // Auth token (required for sync)
  authToken: process.env.TURSO_AUTH_TOKEN,

  // Offline mode (automatically enabled for embedded replicas)
  // You can explicitly set it, but it's enabled by default
  offline: true,

  // Sync interval in seconds (0 = manual sync only)
  syncInterval: 60,

  // Enable vector search for embeddings (optional)
  enableVectorSearch: true
});
```

### Offline Mode Options

The `offline` configuration option controls write behavior:

```typescript
interface TursoDatabaseConfig {
  offline?: boolean;  // Default: auto-detected (true for replicas)
}
```

**When `offline: true` (RECOMMENDED - AUTO-ENABLED):**
- Writes complete instantly (1-2ms)
- Changes sync to remote in background
- Other replicas see changes after next sync (max 60s delay)
- Perfect for single-user dashboards and batch operations

**When `offline: false` (NOT RECOMMENDED):**
- Writes wait for remote confirmation (100-3000ms)
- Other replicas see changes immediately
- Only use if you need real-time multi-user collaboration

See [EMBEDDED-REPLICA-PERFORMANCE.md](./EMBEDDED-REPLICA-PERFORMANCE.md) for detailed performance analysis.

## Migration Scenarios

### Scenario 1: Fresh Start (No Existing Data)

Simplest case - just configure and go:

```bash
# 1. Set up .env with Turso credentials
TURSO_DATABASE_URL=file:modeler.db
TURSO_SYNC_URL=https://modeler-your-org.turso.io
TURSO_AUTH_TOKEN=your-token-here
TURSO_SYNC_INTERVAL=60

# 2. Start your app
npm run dev
```

No migration needed!

### Scenario 2: Existing Local Database → Remote Sync

If you have `modeler.db` with data and want to add cloud sync:

```bash
# 1. Configure .env with remote credentials
TURSO_SYNC_URL=https://modeler-your-org.turso.io
TURSO_AUTH_TOKEN=your-token-here

# 2. Migrate your data to remote (CRITICAL - DO THIS FIRST!)
npx tsx scripts/migrate-to-embedded-replica.ts

# 3. Verify migration succeeded
# Script will show row counts for spaces, nodes, history

# 4. Back up your local database
cp modeler.db modeler.db.backup

# 5. Enable embedded replica in .env
TURSO_DATABASE_URL=file:modeler.db
TURSO_SYNC_URL=https://modeler-your-org.turso.io
TURSO_AUTH_TOKEN=your-token-here
TURSO_SYNC_INTERVAL=60

# 6. Restart your app
npm run dev
```

### Scenario 3: Remote-Only → Local Replica

If you're currently using remote-only and want to add local replica:

```typescript
// Before (remote-only)
const db = new TursoDatabase({
  url: 'https://modeler-your-org.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// After (embedded replica with offline mode)
const db = new TursoDatabase({
  url: 'file:modeler.db',
  syncUrl: 'https://modeler-your-org.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 60
  // offline: true is automatic
});
```

First sync will download your entire remote database to the local file.

## Sync Management

### Automatic Syncing

Configured via `syncInterval` in seconds:

```typescript
// Sync every 60 seconds (recommended for most use cases)
const db = new TursoDatabase({
  syncInterval: 60
});

// More frequent sync (real-time feel, more network usage)
const db = new TursoDatabase({
  syncInterval: 10
});

// Longer interval (batch-heavy workloads)
const db = new TursoDatabase({
  syncInterval: 300  // 5 minutes
});

// Manual sync only (disable auto-sync)
const db = new TursoDatabase({
  syncInterval: 0
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

// Stop auto-sync if needed
db.stopAutoSync();
```

### Sync Strategies

**High-frequency writes (real-time dashboard):**
```typescript
syncInterval: 10  // Sync every 10 seconds
```

**Moderate writes (normal usage):**
```typescript
syncInterval: 60  // Sync every minute (default)
```

**Batch operations (scripts, migrations):**
```typescript
// Disable auto-sync during batch
const db = new TursoDatabase({ syncInterval: 0 });

// ... do batch operations ...

// Manual sync when done
await db.sync();
```

## Testing and Verification

### Performance Testing

Run the performance test to verify your setup:

```bash
npx tsx test-batch-perf.ts
```

**Expected results:**
- Embedded replica with `offline: true`: **1-2ms**
- Embedded replica with `offline: false`: **100-3000ms**
- Pure local (no syncUrl): **0-1ms**

### Verifying Configuration

```typescript
// Check if using embedded replica
if (db.isReplica()) {
  console.log('✓ Using embedded replica with cloud sync');
} else {
  console.log('Using direct remote connection');
}

// Check sync stats
const stats = db.getSyncStats();
if (stats.syncCount > 0) {
  console.log('✓ Sync is working');
  console.log(`  Last sync: ${new Date(stats.lastSyncedAt!)}`);
} else {
  console.log('⚠ No syncs yet');
}
```

## Trade-offs and Considerations

### Offline Mode Trade-offs

| Mode             | Write Speed | Consistency                     | Use Case                           |
| ---------------- | ----------- | ------------------------------- | ---------------------------------- |
| `offline: true`  | 1-2ms       | Eventually consistent (max 60s) | Single-user, dashboards, batch ops |
| `offline: false` | 100-3000ms  | Immediately consistent          | Multi-user real-time collaboration |

### When to Use Embedded Replicas

✅ **Good for:**
- Desktop applications (like Modeler dashboard)
- VMs and VPS deployments
- Heavy read workloads
- Offline capability requirements
- Single-user applications

❌ **Not suitable for:**
- Serverless environments (no filesystem)
- Ephemeral containers
- Multiple concurrent writers to same file
- Applications requiring strong consistency across all users

### Storage Considerations

- Each write consumes minimum 4KB (SQLite page size)
- Full database stored locally
- Monitor file size: `ls -lh modeler.db`

## Troubleshooting

### "File is locked" errors

**Cause:** Multiple processes accessing the database file simultaneously.

**Solution:**
```bash
# Check for running processes
lsof modeler.db

# Kill any duplicate processes
# Only run one instance of the app
```

### Auto-sync not working

**Check:**
1. `TURSO_DATABASE_URL` starts with `file:`
2. `TURSO_SYNC_URL` is set correctly
3. `TURSO_AUTH_TOKEN` is valid
4. `TURSO_SYNC_INTERVAL` > 0

```bash
# Verify environment variables
cat .env | grep TURSO
```

### Slow write performance

**Verify offline mode is enabled:**

```typescript
// Check the configuration
const config = {
  url: 'file:modeler.db',  // Must be file: for replica
  syncUrl: process.env.TURSO_SYNC_URL,  // Must be set
  // offline: true is automatic!
};
```

Run performance test:
```bash
npx tsx test-batch-perf.ts
```

### Sync failures

**Check sync stats:**
```typescript
const stats = db.getSyncStats();
if (stats.lastError) {
  console.error('Sync error:', stats.lastError);
}
```

**Common causes:**
- Network connectivity issues
- Invalid auth token
- Remote database unavailable

**Note:** Local data remains available for reads even if sync fails.

## Best Practices

### 1. Always Back Up Before Migration

```bash
# Before enabling embedded replicas
cp modeler.db modeler.db.backup
```

### 2. Monitor Sync Status

```typescript
// Periodic health check
setInterval(() => {
  const stats = db.getSyncStats();
  if (stats.lastError) {
    console.error('Sync health check failed:', stats.lastError);
  }
}, 60000);  // Every minute
```

### 3. Handle Sync Errors Gracefully

```typescript
try {
  await db.sync();
} catch (error) {
  console.error('Sync failed:', error);
  // Local operations continue unaffected
  // Retry will happen on next interval
}
```

### 4. Use Appropriate Sync Intervals

```typescript
// Development (fast feedback)
syncInterval: 10

// Production (balanced)
syncInterval: 60

// Batch scripts (manual)
syncInterval: 0
```

### 5. Verify Migration Success

```bash
# After migration, check row counts
npx tsx scripts/migrate-to-embedded-replica.ts

# Verify in dashboard
npm run dev
# Check that all spaces appear correctly
```

## References

- [Embedded Replicas Overview](./EMBEDDED-REPLICAS.md)
- [Performance Analysis](./EMBEDDED-REPLICA-PERFORMANCE.md)
- [Turso Documentation](https://docs.turso.tech/features/embedded-replicas/introduction)
- [libSQL Client Docs](https://docs.turso.tech/libsql/client-access/javascript-typescript-sdk)
- Implementation: [turso-database.ts](../src/lib/turso-database.ts#L76)
- Performance Test: [test-batch-perf.ts](../test-batch-perf.ts)

## Summary

Setting up a replicated database with Turso:

1. **Get credentials** from Turso CLI
2. **Configure .env** with local + remote URLs
3. **Migrate existing data** (if applicable) BEFORE enabling replicas
4. **Start your app** - offline mode is automatic for replicas
5. **Enjoy instant writes** (1-2ms) with background cloud sync

The system automatically enables `offline: true` for embedded replicas, giving you **3000x+ faster writes** compared to the default behavior. This makes operations like `insertSpace()` go from ~12 seconds to ~1 second.
