# Embedded Replica Performance Guide

## Critical Performance Issue: Write Latency

When using Turso embedded replicas (local SQLite file with `syncUrl`), write performance depends on the `offline` mode setting.

### The Problem

By default (`offline: false`), **every write operation blocks and waits for the remote Turso database to confirm**. This causes massive latency:

```typescript
// Test results with batch of 13 simple statements:
offline: false  →  3140ms  (waits for network)
offline: true   →     1ms  (local SQLite)
```

**That's a 3140x slowdown!**

For a typical `insertSpace()` operation with embeddings:
- Local only: ~1 second (mostly OpenAI API time)
- With sync: ~12 seconds (10+ seconds wasted on network)

### The Solution

Enable offline mode by setting `offline: true` when creating the client:

```typescript
const db = new TursoDatabase({
  url: 'file:modeler.db',
  syncUrl: process.env.TURSO_SYNC_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  offline: true,  // ← Critical for performance!
  syncInterval: 60
});
```

**Our implementation automatically enables `offline: true` for all embedded replicas** (see [turso-database.ts:79](../src/lib/turso-database.ts#L79)).

## How It Works

### offline: false (default, SLOW)
1. Write operation starts
2. Data is sent to remote Turso over network
3. **Wait for remote confirmation** (100-3000ms depending on network)
4. Update local replica
5. Operation completes

### offline: true (FAST)
1. Write operation starts
2. Data is written to local SQLite immediately (1-2ms)
3. Operation completes instantly
4. **Background sync** pushes changes to remote every `syncInterval` seconds

## Trade-offs

| Mode | Write Speed | Other Replicas See Changes | Use Case |
|------|-------------|----------------------------|----------|
| `offline: false` | 100-3000ms+ | Immediately | Multi-user real-time collaboration |
| `offline: true` | 1-2ms | After next sync (max 60s) | Single-user or eventually-consistent apps |

## Guarantees

Both modes provide **"read-your-writes"** semantics:
- After writing, you can immediately read your own data back
- Your local replica is always up-to-date with your own changes

The difference is how quickly **other replicas** (other users, other servers) see your changes.

## When to Disable Offline Mode

Only set `offline: false` if you need:
- Real-time collaboration where users must see each other's changes immediately
- Strong consistency across all replicas within milliseconds

For most use cases (dashboards, single-user apps, batch operations), **offline mode is strongly recommended**.

## Debugging Write Performance

To test your write performance:

```bash
# Run the performance test script
npx tsx test-batch-perf.ts
```

Expected results:
- Embedded replica with offline:true → 1-2ms
- Embedded replica with offline:false → 100-3000ms
- Pure local (no syncUrl) → 0-1ms

## References

- [Turso Embedded Replicas Docs](https://docs.turso.tech/features/embedded-replicas/introduction)
- [libSQL Client Documentation](https://docs.turso.tech/libsql/client-access/javascript-typescript-sdk)
- Test script: [test-batch-perf.ts](../test-batch-perf.ts)
- Implementation: [turso-database.ts](../src/lib/turso-database.ts)
