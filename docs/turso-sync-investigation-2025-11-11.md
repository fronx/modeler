# Turso Sync Investigation - November 11, 2025

## Problem Statement

Every time we delete a node, the database requires a full manual resync using `force-resync.ts`. This is inefficient and indicates a fundamental issue with our sync strategy.

## Root Cause Discovery

### What We Found

1. **Offline mode bidirectional sync is BETA quality**
   - Conflict detection: ✅ Implemented
   - Conflict resolution: ❌ **Not yet implemented**
   - Source: https://turso.tech/blog/turso-offline-sync-public-beta

2. **Frame Mismatch Errors**
   - Error: `InvalidPushFrameNoHigh(801, 1534)`
   - Means: Local DB at frame 801, remote at frame 1534 (733 frames behind)
   - Cause: Local and remote have diverged, libsql can detect but cannot resolve

3. **The Old DELETE Pattern Was Catastrophic**
   - Previous approach: GET entire space → modify JSON → PUT entire space back
   - This triggered: DELETE all 13 nodes + INSERT all 13 nodes + history INSERTs
   - Result: ~30+ database frames in one operation
   - Exposed pre-existing sync drift → frame mismatch → full corruption

### Why Offline Mode?

**Performance Requirements:**
- Offline mode: 1-2ms writes (local file speed)
- Non-offline mode: 100-300ms writes (network latency)
- **We need offline mode for acceptable performance**

### The Sync Model

According to Turso documentation:

**Normal Mode (offline: false):**
- Writes go directly to remote
- Local replica pulls changes
- No conflicts possible (remote is source of truth)

**Offline Mode (offline: true) - BETA:**
- Writes go to local database
- Sync pushes local changes to remote
- Sync pulls remote changes to local
- **Bidirectional sync = conflict risk**
- Conflicts are detected but NOT auto-resolved

## What We've Fixed

### 1. Proper DELETE Endpoint ✅

**Created:** `DELETE /api/spaces/[spaceId]/thoughts/[nodeId]`

**Implementation:**
- New route: `src/app/api/spaces/[spaceId]/thoughts/[nodeId]/route.ts`
- Database method: `deleteNode(spaceId, nodeKey)` in `turso-database.ts:438`
- Single SQL DELETE statement (1 frame vs ~30 frames)
- Triggers WebSocket broadcast for real-time updates

**Testing:**
```bash
# Delete a node
curl -X DELETE http://localhost:3000/api/spaces/SPACE_ID/thoughts/NODE_ID

# Returns:
# {"success": true, "message": "Node 'NODE_ID' deleted...", ...}
```

### 2. Permission Mode Fixed ✅

**Problem:** Claude CLI had `--permission-mode bypassPermissions`
- Executed ALL commands without asking
- Ignored user requests for confirmation

**Fix:** Removed bypass mode, added selective auto-approval
- Auto-approved: GET requests, jq, ls, Read, Grep, Glob (safe read-only)
- Requires confirmation: DELETE, POST, PUT, PATCH (mutations)

**Location:** `src/lib/claude-cli-session.ts:95-101`

### 3. Disabled Automatic Resync ✅

**Problem:** Runtime resync attempts were:
- Destructive (wipe and rebuild database)
- Often failed anyway
- Created more problems than they solved

**Fix:** Removed automatic resync call at `turso-database.ts:666`
- Now fails visibly with clear error message
- Provides manual recovery instructions
- Prevents silent data corruption

### 4. Fixed Resync Missing Files ✅

**Problem:** Automated `resync()` didn't delete `-info` file
- Left behind libsql metadata
- Caused "metadata exists but db doesn't" errors

**Fix:** Added `-info` file deletion to match `force-resync.ts`

**Location:** `turso-database.ts:738-743`

### 5. Updated Documentation ✅

**Added to `.claude/commands/modeler.md`:**
- DELETE endpoint documentation
- Clarified PATCH usage (metadata only, not for adding/removing nodes)
- Updated examples to use proper endpoints

## The Remaining Challenge

**Current State:**
- Auto-sync every 60 seconds (background)
- Offline mode enabled (fast local writes)
- If remote changes occur between syncs → frame mismatch
- Frame mismatch → cannot recover automatically → manual resync required

**The Trade-off:**
- Keep offline mode = fast performance but sync conflicts possible
- Disable offline mode = slower writes but no conflicts

## Options Going Forward

### Option 1: Aggressive Immediate Sync (Recommended)

**Strategy:**
- Keep offline mode for performance
- Call `sync()` immediately after every mutation
- Reduce background sync interval (60s → 10s)
- Fail operations if sync fails (don't hide errors)

**Pros:**
- Fast local writes
- Conflicts caught immediately
- Clear failure modes

**Cons:**
- Network call after each mutation (~50-100ms overhead)
- Still possible for conflicts if external writes occur

**Implementation:**
```typescript
async deleteNode(spaceId: string, nodeKey: string): Promise<boolean> {
  // ... delete logic ...

  if (result.rowsAffected > 0 && this.isEmbeddedReplica) {
    await this.sync(); // Sync immediately
  }

  return result.rowsAffected > 0;
}
```

### Option 2: Disable Offline Mode

**Strategy:**
- Set `offline: false`
- All writes go to remote first
- Local replica only for reads

**Pros:**
- No sync conflicts ever
- Production-ready (not beta)
- Simpler mental model

**Cons:**
- Writes: 100-300ms (vs 1-2ms)
- Requires network for mutations

### Option 3: Accept Manual Resyncs

**Strategy:**
- Keep current setup
- Document that occasional resyncs are needed
- Make resync faster/easier

**Pros:**
- No code changes needed
- Maximum local performance

**Cons:**
- User friction
- Potential data loss window
- Not scalable for production

### Option 4: Switch to Remote Primary

**Strategy:**
- Use Turso directly without embedded replica
- All operations hit remote database
- Consider adding a caching layer if needed

**Pros:**
- No sync complexity
- Proven production path
- Multiple clients can write safely

**Cons:**
- Network latency on all operations
- Requires rethinking architecture

## Implementation Status

**✅ IMPLEMENTED: Option 1 (Aggressive Immediate Sync)**

Changes made:
1. Added `syncAfterWrite()` helper method to avoid duplication
2. All mutation methods now sync immediately after writes:
   - `insertSpace()` - syncs after batch insert
   - `deleteSpace()` - syncs if row deleted
   - `deleteNode()` - syncs if row deleted
   - `updateSpaceEmbeddings()` - syncs if row updated
   - `saveSession()` - syncs after upsert
   - `touchSession()` - syncs if row updated
   - `deleteSession()` - syncs if row deleted
3. Background sync still runs every 60 seconds as backup

**Recommended Configuration:**
- Keep `TURSO_SYNC_INTERVAL=60` for background sync backup
- Immediate syncs after writes catch conflicts right away
- Manual resync remains available as recovery path (`npx tsx scripts/force-resync.ts`)

**For Production (Future):**
1. Consider **Option 2** (Disable Offline Mode) or **Option 4** (Remote Primary)
2. Turso's offline sync is beta - wait for conflict resolution
3. If performance is critical, add application-level caching instead of embedded replica

## Related Files

- `src/lib/turso-database.ts` - Database client and sync logic
- `src/lib/database-factory.ts` - Singleton database instance
- `src/app/api/spaces/[spaceId]/thoughts/[nodeId]/route.ts` - DELETE endpoint
- `scripts/force-resync.ts` - Manual recovery script
- `.claude/commands/modeler.md` - Updated API documentation

## Next Steps

1. **Decide on sync strategy** (Option 1, 2, 3, or 4)
2. **Implement chosen approach**
3. **Test with real usage patterns**
4. **Monitor sync failures** and adjust interval
5. **Consider migration path** when Turso's offline sync leaves beta

## Key Takeaways

- **Embedded replicas with offline mode are powerful but beta-quality**
- **Conflict detection exists, but resolution does not**
- **Frame mismatches require manual intervention currently**
- **The new DELETE endpoint is efficient (1 frame vs 30)**
- **Performance vs reliability is the core trade-off**

---

*Investigation Date: November 11, 2025*
*Status: Analysis complete, awaiting decision on sync strategy*
