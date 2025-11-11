# Claude CLI Web Integration Analysis

**Date:** 2025-11-08
**Status:** Active Investigation
**Primary Issue:** Tool execution results not reaching frontend

---

## Problem Statement

When using the web UI wrapper around Claude Code CLI mode with tool execution, the frontend never receives completion results. The backend continues executing tools successfully, but the HTTP stream closes before results can be delivered.

### Symptoms

1. **Frontend:** Request timeout, shows loading state indefinitely
2. **Backend:** Tool executions complete successfully with proper results
3. **Logs show:** Result event fires with `listeners: 0` (listeners removed before result arrives)

### Example Log Sequence

```
[getCLISession] ✓ Reusing existing session
[Claude Code API] Event listeners attached, result listeners: 1
[Claude CLI] Session ID: 2f708c6a-a3f2-4d5b-b7dd-d7897c7b4f29
[Claude CLI] ✓ Session fully initialized
[Claude Code API] Stream timeout - closing after 60 seconds  ← At 5s mark
[Claude Code API] Cleaning up to trigger result emission
[Claude CLI Tool Use] Bash { id: 'toolu_...', ... }
[Claude CLI Result Event] { result: '...', duration_ms: 11177 }
[Claude CLI] Result event emitted, listeners: 0  ← TOO LATE
```

---

## Critical Discovery: Timeout Correlation

**Key Finding:** Result arrival time correlates directly with timeout value at ~2.2x ratio

| Timeout Setting | Result Arrival Time | Ratio |
|----------------|---------------------|-------|
| 5 seconds | ~11 seconds | 2.2x |
| 30 seconds | ~66 seconds | 2.2x |
| 60 seconds | ~132 seconds | 2.2x |

**Implication:** The timeout itself is **causing** the delay, not just being too short for the operation.

---

## Investigation Timeline

### Phase 1: Initial Hypotheses (RULED OUT)

#### Hypothesis 1.1: stdin open/closed issue ❌
- **Theory:** Keeping stdin open vs closing it affects result emission
- **Test:** Modified test script to test both modes
- **Result:** Both modes work fine in test, not the issue
- **Evidence:** Test 4 with stdin kept open completed successfully in 23.81s

#### Hypothesis 1.2: Timeout too short ❌
- **Theory:** Just need longer timeout (5 min → 30 sec → 60 sec)
- **Result:** Longer timeouts just made results arrive even later (2.2x correlation)
- **Conclusion:** Timeout value affects result timing, not just detection

#### Hypothesis 1.3: Database sync conflicts ✅ FIXED (unrelated)
- **Issue:** Multiple TursoDatabase instances with competing sync intervals
- **Fix:** Singleton `createDatabase()` factory
- **Status:** Fixed but didn't solve main issue

#### Hypothesis 1.4: API key vs subscription billing ✅ FIXED (unrelated)
- **Issue:** Using ANTHROPIC_API_KEY instead of Max subscription
- **Fix:** Remove API key from spawned process environment
- **Status:** Fixed but didn't solve main issue

### Phase 2: Event Flow Investigation

#### Hypothesis 2.1: Result event not firing ❌
- **Theory:** Claude CLI not emitting result event
- **Evidence:** Logs show `[Claude CLI Result Event]` DOES fire
- **Problem:** Fires to `listeners: 0` because cleanup already ran

#### Hypothesis 2.2: Listeners not attached properly ❌
- **Theory:** Event listeners not registering correctly
- **Evidence:** Logs show `result listeners: 1` right after attachment
- **Problem:** Listeners get removed by cleanup before result arrives

#### Hypothesis 2.3: Session process dying and restarting ❌
- **Theory:** Resume endpoint kills persistent session, causing issues
- **Investigation:** Resume works fine for simple messages, only tool calls break
- **Evidence:** User confirmed "I'm able to continue a past session. It's just when there's a tool call that it falls apart."

### Phase 3: Current Understanding

#### Hypothesis 3.1: cleanup() causes backpressure ⚠️ CURRENT
- **Theory:** Removing event listeners blocks stdout processing in Claude CLI
- **Evidence:** Result arrives at exactly 2.2x the timeout value
- **Mechanism:**
  1. Timeout fires at T seconds
  2. `cleanup()` removes all listeners including stdout handlers
  3. Claude CLI stdout buffer backs up or blocks
  4. Takes another ~T seconds to flush/unblock
  5. Result finally arrives at ~2.2T seconds
- **Status:** NEEDS TESTING

---

## Technical Architecture

### Persistent Session Design

```
Server Startup
  └─> ClaudeCLISession singleton created
       └─> spawn('claude', ['--print', '--input-format', 'stream-json', ...])
            └─> Keep stdin/stdout open
            └─> handleStdout() continuously processes messages

HTTP Request #1
  └─> getCLISession() returns existing session
  └─> Attach temporary listeners (data, tool_use, result)
  └─> session.sendMessage(userPrompt)
  └─> Wait for 'result' event
  └─> Detach listeners via cleanup()
  └─> Close HTTP response stream
  └─> Session stays alive for next request

HTTP Request #2 (reuses same session)
  └─> Attach new temporary listeners...
```

### stream-json Message Format

**User Message (sent to stdin):**
```json
{"type":"user","message":{"role":"user","content":"<prompt>"},"parent_tool_use_id":null}
```

**Init Message (from stdout, once per process):**
```json
{"type":"system","subtype":"init","session_id":"abc-123","cwd":"/path",...}
```

**Assistant Message (from stdout):**
```json
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
```

**Tool Use (from stdout):**
```json
{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_...","name":"Bash","input":{...}}]}}
```

**Result Message (from stdout, signals completion):**
```json
{"type":"result","subtype":"success","is_error":false,"duration_ms":11177,"result":"..."}
```

### Event Flow in Code

**Session Level** (`src/lib/claude-cli-session.ts`):
1. `start()` - Spawns process, sets up stdout handler (line 81-146)
2. `handleStdout()` - Parses JSON messages, emits events (line 150-219)
3. `sendMessage()` - Writes to stdin (line 224-249)

**API Route Level** (`src/app/api/claude-code/route.ts`):
1. `getCLISession()` - Gets singleton session (line 37)
2. Attach event listeners (line 121-125)
3. `session.sendMessage()` - Send user message (line 129)
4. Set timeout (line 133)
5. Wait for `result` event → calls `onResult()` → calls `cleanup()` → closes stream

### The cleanup() Function

**Location:** `src/app/api/claude-code/route.ts:79-91`

```typescript
const cleanup = () => {
  // Clear timeout
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  // Remove event listeners from session
  session.off('data', onData);
  session.off('error', onError);
  session.off('tool_use', onToolUse);
  session.off('tool_denials', onToolDenials);
  session.off('result', onResult);  // ← This prevents result from being received
};
```

**Current Problem:** Called by timeout at 5s, removes listeners, result arrives at 11s with no listeners.

---

## File Locations Reference

### Main Files

- **API Route:** `src/app/api/claude-code/route.ts`
  - Handles HTTP requests, attaches listeners, manages timeouts

- **Session Manager:** `src/lib/claude-cli-session.ts`
  - ClaudeCLISession class, persistent process management
  - Lines 81-146: start() method
  - Lines 150-219: handleStdout() message parsing
  - Lines 224-249: sendMessage()
  - Lines 301-315: CLISessionManager.get()

- **Resume Endpoint:** `src/app/api/claude-code/sessions/resume/route.ts`
  - User-triggered session resume (UI button)
  - Spawns separate process with --resume flag
  - Process exits immediately after resume

- **Database Factory:** `src/lib/database-factory.ts`
  - Singleton database instance
  - Fixed sync conflicts

### Test Files

- **Test Script:** `test-claude-cli-stream.ts`
  - Successfully tests both stdin open/closed modes
  - Tool execution completes in 23-24 seconds
  - Result events arrive correctly

- **Test Output:** `test-output.log`
  - Shows successful test runs with proper timing

### Debug Documents

- **Original Debug Notes:** `CLAUDE-CLI-WEB-INTEGRATION-DEBUG.md`
  - Earlier investigation notes
  - Some outdated hypotheses

- **This Document:** `docs/claude-cli-web-integration-analysis.md`
  - Current comprehensive analysis

---

## Agent Investigation Reports Summary

### Agent 1: Init Message Handling
**Found:** Init messages only sent once per process startup, NOT on each user message.
**Files:** `src/lib/claude-cli-session.ts:158-176`

### Agent 2: Session Lifecycle
**Found:**
- `ready()` check doesn't set `process = null` on close
- Race condition possible between close and ready check
- Resume endpoint spawns separate process that exits
**Files:** `src/lib/claude-cli-session.ts:129-134, 268-270, 301-315`

### Agent 3: Stream-JSON Format
**Found:**
- Exact message format written to stdin
- Init only appears once per process
- Tool execution takes 20-24 seconds in tests
- Timeout set to 5000ms but comment says "60 seconds"
**Files:** `src/lib/claude-cli-session.ts:240`, `src/app/api/claude-code/route.ts:140`

### Agent 4: Log Sequence Tracing
**Found:**
- Resume endpoint spawns process that exits with code 0
- Next request tries to reuse dead session (race condition)
- Session ID logs appear from async stdout processing
**Files:** `src/app/api/claude-code/sessions/resume/route.ts:22`

---

## Proposed Solution

### Primary Fix: Don't Call cleanup() in Timeout

**File:** `src/app/api/claude-code/route.ts:133-140`

**Current Code:**
```typescript
timeoutId = setTimeout(() => {
  if (!responseComplete) {
    console.warn('[Claude Code API] Stream timeout - closing after 60 seconds');
    console.warn('[Claude Code API] Cleaning up to trigger result emission');
    cleanup();  // ← PROBLEM: Removes listeners
  }
}, 5000);
```

**Proposed Change:**
```typescript
timeoutId = setTimeout(() => {
  if (!responseComplete) {
    console.warn('[Claude Code API] Stream timeout - closing HTTP stream only');
    responseComplete = true;

    // Clear this timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Close HTTP stream for frontend
    try {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    } catch (e) {
      // Controller already closed
    }

    // DON'T call cleanup() - keep listeners attached
    // Result will arrive soon and cleanup will happen in onResult()
  }
}, 5000);
```

**Expected Behavior:**
1. Frontend gets timeout response at 5s
2. Backend keeps processing with listeners still attached
3. Result arrives at ~5-6s (not 11s)
4. `onResult()` fires, calls `cleanup()`, removes listeners
5. No listener leak because cleanup happens on result

### Alternative Approaches (if primary fix doesn't work)

#### Option B: Delayed Cleanup
Keep timeout but delay cleanup by additional time:
```typescript
setTimeout(() => {
  cleanup();  // Remove this from here
}, 5000);

// Add separate cleanup timeout
setTimeout(() => {
  if (!responseComplete) {
    cleanup();  // Only cleanup after longer period
  }
}, 180000);  // 3 minutes
```

#### Option C: No Timeout at All
Remove timeout completely, rely entirely on result event:
```typescript
// Just attach listeners and wait
// No timeout
// Cleanup only when result arrives or request aborts
```

#### Option D: Process-Level Monitoring
Add health check to detect when Claude CLI is stuck:
```typescript
let lastActivityTime = Date.now();

session.on('data', () => {
  lastActivityTime = Date.now();
});

setInterval(() => {
  if (Date.now() - lastActivityTime > 60000) {
    // No activity for 60s, something is stuck
    cleanup();
  }
}, 5000);
```

---

## Testing Plan

### Test 1: Basic Tool Execution
**Action:** Send message that requires bash tool (e.g., "list files")
**Expected:**
- Frontend timeout at 5s
- Backend logs result at ~5-6s (not 11s)
- Result has listeners available

### Test 2: Multiple Sequential Requests
**Action:** Send 3 requests in a row with tool use
**Expected:**
- Each request's listeners cleaned up properly
- No listener accumulation
- Results arrive at consistent ~5s timing

### Test 3: No Tool Execution
**Action:** Send simple message without tools
**Expected:**
- Result arrives quickly (<5s)
- No timeout needed
- Proper cleanup

### Test 4: Long-Running Tool
**Action:** Send message with tool that takes 20+ seconds
**Expected:**
- Frontend timeout at 5s
- Backend continues processing
- Result arrives after tool completes
- Cleanup happens after result

---

## Mistakes We Made (For Future Reference)

1. **Focusing on timeout value instead of timeout effect**
   - Kept adjusting timeout duration (10s → 30s → 60s → 5min)
   - Should have questioned why timeout value correlated with result time

2. **Assuming cleanup was needed**
   - Thought removing listeners was proper resource management
   - Didn't realize cleanup was causing the blocking

3. **Over-investigating session lifecycle**
   - Spent time on resume endpoint, process exits, session reuse
   - User confirmed resume works fine, only tool calls break

4. **Not recognizing the 2.2x pattern early**
   - Data was there from first test (5s → 11s)
   - Pattern confirmed with 60s → 132s
   - Should have recognized correlation immediately

5. **Confusing async logs with sync execution**
   - Thought "Session fully initialized" appearing in logs meant init message was being sent during request
   - Actually just async stdout processing from earlier

---

## Questions Still Unanswered

1. **Why exactly 2.2x multiplier?**
   - What's special about that ratio?
   - Is it Node.js buffer size related?
   - Is it Claude CLI internal timing?

2. **What's the actual mechanism of the blockage?**
   - EventEmitter behavior when no listeners?
   - Stdout buffer backpressure?
   - Claude CLI waiting for acknowledgment?

3. **Why do tool calls specifically trigger this?**
   - Simple messages work fine
   - Tool execution breaks
   - Is it the longer processing time or something about tool execution?

4. **Is there a proper "end of turn" signal we're missing?**
   - Should we be sending something back to Claude CLI after receiving messages?
   - Is there a handshake we're not completing?

---

## Next Steps

1. **Implement primary fix** (don't call cleanup in timeout)
2. **Test thoroughly** with all test scenarios
3. **Document results** of the fix attempt
4. **If fix works:** Clean up code, remove debug logs, update main debug doc
5. **If fix doesn't work:** Try alternative approaches B, C, or D
6. **Add monitoring** to detect if issue reoccurs in production

---

## Success Criteria

- ✅ Tool execution results reach frontend reliably
- ✅ Result arrival time independent of timeout value
- ✅ No listener leaks (verify with multiple sequential requests)
- ✅ Backend logs show result emitted with listeners > 0
- ✅ Frontend receives complete response including tool results
- ✅ No "Controller already closed" errors
- ✅ Consistent timing across different operations

---

*End of Analysis Document*
