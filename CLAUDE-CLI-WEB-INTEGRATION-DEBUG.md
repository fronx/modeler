# Claude CLI Web Integration Debug Log

**Date:** 2025-11-08
**Goal:** Fix web UI integration with persistent Claude CLI session for tool execution

## Problem Statement

When using the web UI wrapper around Claude Code CLI mode, the connection drops before tool executions complete. The backend continues executing tools, but the frontend never receives the results.

### Symptoms

1. **Frontend:** Request completes with timeout after 10s
2. **Backend:** Tool executions continue after frontend disconnect
3. **Server logs show:**
   - Session starts successfully
   - Tool use events are logged
   - But `result` event never fires or isn't being handled correctly
   - Stream timeout warning after 10s (now reduced from 2 minutes)

### Example Error Flow

```
[Claude CLI] Session ID: 2f708c6a-a3f2-4d5b-b7dd-d7897c7b4f29
[Claude CLI] ✓ Session fully initialized

[Claude CLI Tool Use] Bash {
  id: 'toolu_01R2NBKnhmHPnBHe5AudETiH',
  input: {
    command: 'npx tsx scripts/space-cli.ts get "2025-11-08T14-46-09-187Z" --nodes-only',
    description: 'Check current space state'
  }
}

[Claude Code API] Stream timeout - closing after 5 minutes
POST /api/claude-code 200 in 10411ms

# Tool executions continue server-side but web UI has disconnected
```

## Root Causes Identified

### Issue 1: Turso Database Sync Conflicts ✅ FIXED

**Problem:** Multiple `TursoDatabase` instances with competing auto-sync intervals caused:
- Frame number mismatches: `InvalidPushFrameNoHigh(1257, 1869)`
- Database lock errors: `max_frame_no failed: database is locked`

**Root Cause:** Each `ClaudeCLISession` instance created its own `TursoDatabase` instance with separate sync timers.

**Fix:** Use singleton `createDatabase()` factory
- **File:** [src/lib/claude-cli-session.ts:74](src/lib/claude-cli-session.ts#L74)
- **File:** [src/lib/database-factory.ts](src/lib/database-factory.ts) - Extended interface with session methods

**Status:** ✅ Fixed - No more sync errors

---

### Issue 2: API Key vs Subscription Billing ✅ FIXED

**Problem:** Claude CLI was using `ANTHROPIC_API_KEY` from environment, causing "Credit balance is too low" errors instead of using Max subscription.

**Root Cause:** Environment variable `ANTHROPIC_API_KEY` takes precedence over subscription auth.

**Fix:** Remove API key from spawned process environment
- **File:** [src/lib/claude-cli-session.ts:103-111](src/lib/claude-cli-session.ts#L103-L111)
```typescript
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;

this.process = spawn('claude', args, {
  cwd: this.config.workingDir,
  stdio: ['pipe', 'pipe', 'pipe'],
  env  // Clean environment without API key
});
```

**Status:** ✅ Fixed - Now uses Max subscription

---

### Issue 3: Stream Completion Detection ⚠️ PARTIALLY FIXED / ONGOING

**Problem:** HTTP response stream closes before Claude finishes executing all tools.

**Architecture Understanding:**

1. **Persistent ClaudeCLISession** - Lives for entire server lifetime
2. **Individual HTTP Requests** - Attach temporary listeners, wait for completion, then detach
3. **Session stays alive** - Ready for next request immediately

**Key Insight from Test (`test-claude-cli-stream.ts`):**

When Claude CLI runs in `--print` mode with `stream-json`:
- All tool uses arrive in **one assistant message** (multiple `tool_use` blocks)
- Tool results come back as **separate user messages**
- Final `result` message signals **conversation turn is complete**
- Process exits cleanly after result

**Example Message Flow:**
```
Message #2: Type: assistant → Text content
Message #3: Type: assistant → Tool Use #1: Bash
Message #4: Type: assistant → Tool Use #2: Bash
Message #5: Type: assistant → Tool Use #3: Bash
Message #6: Type: user → Tool result for #1
Message #7: Type: user → Tool result for #3
Message #8: Type: user → Tool result for #2
Message #9: Type: assistant → Final response text
Message #10: Type: result (success) ← THIS signals complete
```

**Attempted Fix:**

Changed stream completion logic to listen for `result` event instead of using timeout:

- **File:** [src/lib/claude-cli-session.ts:191-201](src/lib/claude-cli-session.ts#L191-L201)
  - Emit `result` event when `msg.type === 'result'`

- **File:** [src/app/api/claude-code/route.ts:94-106](src/app/api/claude-code/route.ts#L94-L106)
  - Listen for `result` event
  - Close HTTP stream (not session) when result arrives
  - Safety timeout extended to 5 minutes (currently 10s for testing)

**Current Status:** ⚠️ Stream closing prematurely, blocking tool completion

**What's Actually Happening:**

1. Session initializes correctly
2. First tool use: `Bash { id: 'toolu_01R2NBKnhmHPnBHe5AudETiH', command: 'npx tsx scripts/space-cli.ts get ...' }`
3. Stream timeout fires at 10s → HTTP stream closes
4. **~1 minute later (server-side):** `BashOutput { id: 'toolu_0146sG9MxfAre3jzwFMEyHQk', bash_id: 'dbabe5' }`
5. Result event would fire eventually, but stream is already closed

**Working Theory:**

Claude appears to run bash commands **in the background** and poll for output using `BashOutput` tool calls. The observed sequence is:

```
1. Bash tool use → Start background process
2. (Wait for process to complete - can take minutes)
3. BashOutput tool use → Poll for output
4. (More BashOutput calls if needed)
5. Final text response
6. Result event → Conversation complete
```

Our 10s timeout kills the HTTP stream before Claude can poll for the bash output, so:
- Frontend disconnects
- Backend continues execution
- Claude makes `BashOutput` calls but HTTP client is gone
- Eventually completes server-side but frontend never sees it

**Hypothesis:** The 10s timeout is too short for tool execution chains that include background processes and polling.

## Test Files Created

### `test-claude-cli-stream.ts` ✅

**Purpose:** Understand Claude CLI `stream-json` output format

**Method:**
- Spawn Claude with `--print --input-format stream-json --output-format stream-json`
- Send one message via stdin
- Log all output messages with timestamps
- Close stdin after sending message

**Results:**
- **Test 1 (simple):** 13.7s total, 3 messages, 0 tools, 1 result
- **Test 2 (with tool):** 26.5s total, 5 messages, 1 tool use, 1 result
- **Test 3 (multiple tools):** 19.1s total, 10 messages, 3 tool uses, 1 result

**Key Finding:** `--print` mode with single message works perfectly when stdin is closed after sending.

**Difference from our implementation:**
- Test closes stdin: `claude.stdin?.end();`
- Our persistent session keeps stdin open for multiple messages

## Proposed Solution: Extend Timeout

### Rationale

If the theory about background process polling is correct, we need to:

1. **Increase timeout significantly** - From 10s to 5-10 minutes to allow for long-running tools
2. **Keep streaming all events** - Forward all tool uses (including `BashOutput` polling) to frontend
3. **Wait for `result` event** - Only close when Claude signals true completion

### Implementation

**File:** [src/app/api/claude-code/route.ts:125](src/app/api/claude-code/route.ts#L125)

Change timeout from:
```typescript
}, 10000); // 10 second timeout - TOO SHORT
```

To:
```typescript
}, 300000); // 5 minute timeout for long-running tool chains
```

Or better yet: Make it configurable based on use case.

### Why This Works

- Claude's background bash execution can take 1+ minutes
- `BashOutput` polling happens multiple times
- Only after all tools complete does `result` event fire
- HTTP stream needs to stay open for the entire chain
- Frontend will see all intermediate tool uses (including polling)

### Alternative: Remove Timeout Entirely

Since we have the `result` event as the proper completion signal, we could:
1. Remove timeout completely
2. Rely solely on `result` event
3. Add request-level timeout at Next.js layer if needed

This would be cleaner but requires confidence that `result` will always fire.

## Next Steps

1. **Test Hypothesis 2 first** - Verify the tool command works manually
2. **Add comprehensive logging** - Track event emission and listener attachment
3. **Test Hypothesis 1** - Try removing `--print` flag
4. **Create multi-message test** - Replicate persistent session behavior in test script
5. **Check stderr** - Tool errors might be going to stderr

## Architecture Notes

### Persistent Session Design (Current)

```
Server Startup
  └─> ClaudeCLISession created (singleton)
       └─> spawn('claude', ['--print', '--input-format', 'stream-json', ...])
            └─> Keep stdin/stdout open
            └─> Listen for messages continuously

HTTP Request #1
  └─> Attach temporary listeners (data, tool_use, result)
  └─> Write message to session stdin
  └─> Wait for 'result' event
  └─> Detach listeners
  └─> Close HTTP response stream
  └─> Session stays alive

HTTP Request #2 (same session)
  └─> Attach temporary listeners...
  └─> (repeat)
```

### Key Files

- **Session Manager:** [src/lib/claude-cli-session.ts](src/lib/claude-cli-session.ts)
- **API Route:** [src/app/api/claude-code/route.ts](src/app/api/claude-code/route.ts)
- **Database Singleton:** [src/lib/database-factory.ts](src/lib/database-factory.ts)
- **Test Script:** [test-claude-cli-stream.ts](test-claude-cli-stream.ts)
- **Performance Notes:** [PERFORMANCE-INVESTIGATION.md](PERFORMANCE-INVESTIGATION.md)

### Performance Targets

From [PERFORMANCE-INVESTIGATION.md](PERFORMANCE-INVESTIGATION.md):
- CLI streaming mode: ~2.6s average response time
- Comparable to SDK streaming mode
- Uses Max subscription (no API credits)

## Questions to Answer

1. Does `--print` mode work with persistent stdin, or does it expect stdin to close?
2. Is the tool execution actually hanging, or is something else blocking the result?
3. Are we correctly handling the full message flow (tool_use → tool_result → result)?
4. Should we be sending tool results back to stdin, or does `--print` mode handle that automatically?

## Current Status Summary

✅ **Fixed Issues:**
- Database sync conflicts
- Billing (now uses Max subscription)
- Event emission structure
- **Timeout mismatch (ROOT CAUSE FIXED!)**

## Root Cause: Timeout Mismatch ✅ FIXED

**Problem:** API route timeout was set to 10 seconds, but tool execution takes 20-24 seconds.

**Evidence from Test Results:**
- Test 1 (no tools): 14.12s - Within 10s? No, but simple enough
- Test 2 (no tools, stdin open): 14.16s - Close to limit
- Test 3 (with tool, stdin closed): 24.34s - **EXCEEDS 10s timeout**
- Test 4 (with tool, stdin open): 23.81s - **EXCEEDS 10s timeout**

**The Code Bug:**
```typescript
// File: src/app/api/claude-code/route.ts:125
}, 10000); // Comment said "5 minutes" but actual value was 10 seconds!
```

**The Fix:**
```typescript
}, 300000); // 5 minute safety timeout for long-running tool chains
```

**Why This Matters:**
- Claude CLI uses background bash execution for tools
- Bash tool launches process, then polls with BashOutput
- Full tool chain takes 20-24 seconds on average
- 10 second timeout killed stream before completion
- Frontend disconnected while backend continued executing

**Status:** ✅ Fixed by changing timeout from 10s to 300s (5 minutes)
