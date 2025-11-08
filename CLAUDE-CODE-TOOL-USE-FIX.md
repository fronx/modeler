# Claude Code Tool Use Fix

## Problem

When Claude Code made tool calls through the web interface, the conversation would stall after the tool call. There was no output about the tool use success/failure, and Claude didn't continue speaking after making the tool call.

### Example Issue

```
User: Did that work?

Claude: Yes, I can see the current space structure! It's what ChatGPT created...

[Claude makes a Read tool call]

[SILENCE - no continuation, no feedback]
```

## Root Causes

### 1. Backend: Missing Tool Use Event Emission

**File:** [src/lib/claude-cli-session.ts](src/lib/claude-cli-session.ts)

The CLI session handler (`handleStdout`) only processed text content blocks and result messages. It ignored `tool_use` blocks in the assistant's message content.

**Before:**
```typescript
// Only handled text blocks
if (block.type === 'text' && block.text) {
  this.emit('data', block.text);
}
```

**After:**
```typescript
// Now handles both text and tool use blocks
if (block.type === 'text' && block.text) {
  this.emit('data', block.text);
} else if (block.type === 'tool_use') {
  this.emit('tool_use', {
    id: block.id,
    name: block.name,
    input: block.input
  });
}
```

### 2. Missing Permission Denials Emission

The CLI session wasn't emitting `tool_denials` events when tools were denied, making it impossible for the UI to show why a tool was blocked.

**Added:**
```typescript
if (msg.type === 'result') {
  // Emit permission denials if any
  if (msg.permission_denials && msg.permission_denials.length > 0) {
    this.emit('tool_denials', msg.permission_denials);
  }
  this.emit('message_complete', msg);
}
```

## Solution

### Changes Made

1. **Updated TypeScript Types** - Added proper type definitions for tool use blocks:
   ```typescript
   interface ToolUseBlock {
     type: 'tool_use';
     id: string;
     name: string;
     input: any;
   }

   interface TextBlock {
     type: 'text';
     text: string;
   }

   type ContentBlock = TextBlock | ToolUseBlock;
   ```

2. **Enhanced handleStdout Method** - Now processes tool use blocks and emits appropriate events:
   - `tool_use` event when Claude calls a tool
   - `tool_denials` event when tools are denied by permissions
   - Console logging for server-side visibility

3. **Matched SDK Implementation** - The CLI session now has feature parity with the SDK session, both emitting the same events.

## How It Works Now

### Event Flow

1. **User sends message** → Claude Code CLI receives it
2. **Claude responds** with content blocks (text + tool_use)
3. **Backend processes stream:**
   - Text blocks → emit `data` event → frontend displays text
   - Tool use blocks → emit `tool_use` event → frontend displays tool call
   - Result message → emit `tool_denials` (if any) + `message_complete`
4. **Frontend displays:**
   - Claude's text response
   - Tool uses (expandable, purple border)
   - Tool denials (expandable, red border)
5. **Claude continues** after tool execution

### Expected UI Behavior

```
Claude: Let me read the current space to see what ChatGPT created...

[▶ Tool: Read]  ← Collapsible, shows tool name
  (click to expand and see input parameters)

Claude: I can see the space has 5 nodes at position 0 with no relationships.
Let me rebuild it properly...
```

## Testing the Fix

### Manual Test

1. Start the development server (if not already running)
2. Open the Claude Code chat panel
3. Send a message that requires tool use:
   ```
   Read the current space and tell me what you see
   ```
4. Verify:
   - Claude's text appears before the tool call
   - Tool use appears as a collapsible block with purple border
   - Claude continues speaking after the tool completes
   - No stalling or silence after tool calls

### Expected Console Output (Server-side)

```
[Claude CLI Tool Use] Read {
  id: 'toolu_01ABC123...',
  input: { file_path: '/path/to/space.ts' }
}

[Session Result] {
  subtype: 'success',
  duration_ms: 1523,
  num_turns: 2
}
```

## Files Modified

- [src/lib/claude-cli-session.ts](src/lib/claude-cli-session.ts) - Added tool use and denial event emission

## Related Files (No Changes Needed)

- [src/app/api/claude-code/route.ts](src/app/api/claude-code/route.ts) - Already listens for tool events
- [src/components/ChatMessage.tsx](src/components/ChatMessage.tsx) - Already displays tool uses
- [src/components/ChatPanelClaudeCode.tsx](src/components/ChatPanelClaudeCode.tsx) - Already handles tool events

## Comparison with SDK Mode

Both CLI and SDK modes now have identical behavior:

| Feature | SDK Mode | CLI Mode |
|---------|----------|----------|
| Text streaming | ✅ | ✅ |
| Tool use events | ✅ | ✅ (fixed) |
| Tool denials | ✅ | ✅ (fixed) |
| Continuation after tools | ✅ | ✅ (fixed) |
| Console logging | ✅ | ✅ (fixed) |

## Notes

- The fix only required backend changes in the CLI session handler
- Frontend already had full support for displaying tool uses
- No changes to the API endpoint were needed
- SDK mode already worked correctly, this brings CLI mode to parity
