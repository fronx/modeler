# Cancel Button Implementation Plan

## Problem Statement

We want to add a cancel button to the web UI that allows users to interrupt Claude while it's thinking, using tools, or performing any time-consuming operation.

## Research Findings

### SDK vs CLI Modes

The codebase currently supports two modes:

1. **SDK Mode** (`claude-code-session.ts`)
   - Uses `@anthropic-ai/claude-agent-sdk` package
   - Has built-in `query.interrupt()` method for cancellation ✅
   - **Works with Max subscription** (confirmed via Reddit thread)
   - Just needs `ANTHROPIC_API_KEY` environment variable to be unset

2. **CLI Mode** (`claude-cli-session.ts`) - Currently Active
   - Spawns `claude` CLI binary directly with `spawn()`
   - Uses `stream-json` input/output format
   - No clean cancellation mechanism - signals either kill the process or cause JSON parsing errors
   - Currently defaults to this mode to use Max subscription

### Key Discovery: SDK Can Use Max Subscription

From Reddit thread: https://www.reddit.com/r/ClaudeAI/comments/1leigee/claude_sdk_usage_with_claude_max_subscription/

Multiple users confirmed:
- SDK works with Max subscription
- Just need to ensure `ANTHROPIC_API_KEY` is not set: `unset ANTHROPIC_API_KEY`
- Uses existing Claude login credentials

## Current Implementation Status

### ✅ Already Implemented

1. **SDK Cancel Method** ([claude-code-session.ts:282-295](src/lib/claude-code-session.ts#L282-L295))
   ```typescript
   async cancel(): Promise<void> {
     await this.currentQuery.interrupt();
     this.emit('cancelled', { message: 'Operation cancelled by user' });
   }
   ```

2. **Cancel API Endpoint** ([src/app/api/claude-code/cancel/route.ts](src/app/api/claude-code/cancel/route.ts))
   - POST endpoint that calls `session.cancel()`
   - Works with both SDK and CLI modes

3. **Cancel Button UI** ([ChatInput.tsx:55-76](src/components/ChatInput.tsx#L55-L76))
   - Red X button appears when `isLoading && onCancel` is true
   - Replaces send button during operation
   - Connected to cancel handler in ChatPanelClaudeCode

4. **Frontend Cancel Handler** ([ChatPanelClaudeCode.tsx:202-223](src/components/ChatPanelClaudeCode.tsx#L202-L223))
   - Calls `/api/claude-code/cancel`
   - Updates UI state
   - Shows cancellation message

### ❌ Not Yet Working

**CLI Mode Cancellation** ([claude-cli-session.ts:307-323](src/lib/claude-cli-session.ts#L307-L323))
- Current implementation sends SIGTERM (kills process)
- Alternative attempts:
  - Escape character (`\x1B`) → breaks JSON stream parser
  - SIGINT → likely kills process or causes errors
- Process restart takes 2-3 seconds

## Recommended Solution

### Switch to SDK Mode for Web UI

**Why:**
- ✅ SDK has proper `query.interrupt()` support
- ✅ Works with Max subscription (no API credits needed)
- ✅ Session survives cancellation (no restart delay)
- ✅ All UI components already implemented and ready

**Changes Needed:**

1. **Update Mode Selection** ([src/app/api/claude-code/route.ts:13](src/app/api/claude-code/route.ts#L13))
   ```typescript
   // Change from:
   const USE_CLI_MODE = process.env.USE_SDK !== 'true';

   // To:
   const USE_CLI_MODE = process.env.USE_CLI === 'true';
   ```
   This makes SDK the default, CLI opt-in

2. **Ensure Environment Variable Not Set**
   - Check that `ANTHROPIC_API_KEY` is not in `.env` or environment
   - SDK will use Max subscription login automatically

3. **Test Cancellation**
   - Start long operation (e.g., "Write a 500-word story")
   - Click cancel button during generation
   - Verify operation stops immediately
   - Verify session remains active for new messages

## Alternative: Fix CLI Mode Cancellation

If we must use CLI mode, options are limited:

1. **Accept Process Restart** (current SIGTERM approach)
   - Pro: Guaranteed to stop operation
   - Con: 2-3 second restart delay
   - Con: Loses any partial response

2. **Test SIGINT Behavior**
   - Created test script: [test-cli-cancel.ts](test-cli-cancel.ts)
   - Run: `npx tsx test-cli-cancel.ts`
   - Will determine if SIGINT cancels without killing

3. **Custom Control Message** (speculative)
   - Investigate if `stream-json` mode accepts control messages
   - No documentation found yet

## Implementation Timeline

### Immediate (< 5 min)
1. Change default mode to SDK in route.ts
2. Verify `ANTHROPIC_API_KEY` not set
3. Restart dev server
4. Test cancel button

### If Issues Arise
1. Run CLI test script to understand SIGINT behavior
2. Document actual behavior
3. Implement appropriate fallback

## Files Modified

- ✅ [src/components/ChatInput.tsx](src/components/ChatInput.tsx) - Cancel button UI
- ✅ [src/components/ChatPanelClaudeCode.tsx](src/components/ChatPanelClaudeCode.tsx) - Cancel handler
- ✅ [src/app/api/claude-code/cancel/route.ts](src/app/api/claude-code/cancel/route.ts) - Cancel API
- ✅ [src/lib/claude-code-session.ts](src/lib/claude-code-session.ts) - SDK cancel method
- ⏳ [src/app/api/claude-code/route.ts](src/app/api/claude-code/route.ts) - Mode selection (pending)
- ⚠️ [src/lib/claude-cli-session.ts](src/lib/claude-cli-session.ts) - CLI cancel (problematic)

## Test Script

Created [test-cli-cancel.ts](test-cli-cancel.ts) to verify CLI SIGINT behavior:
- Spawns CLI in stream-json mode
- Sends long-running request
- Sends SIGINT after 2 seconds
- Monitors if process survives

## References

- Reddit: SDK with Max subscription works - https://www.reddit.com/r/ClaudeAI/comments/1leigee/claude_sdk_usage_with_claude_max_subscription/
- SDK Query.interrupt() docs: [node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:396](node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts#L396)
- Interactive mode Ctrl+C docs: Cancels current operation without killing session

## Next Steps

1. Review this plan
2. Decide: SDK mode (recommended) or test CLI SIGINT behavior
3. Implement chosen approach
4. Test thoroughly
5. Document final solution

---

**Status:** Ready for implementation
**Blocker:** None - all code is written, just need to switch mode
**Risk:** Low - can revert to CLI mode if SDK issues arise
