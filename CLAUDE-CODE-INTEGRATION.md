# Claude Code Integration

This project includes two implementations for integrating with Claude Code, allowing you to choose between using your **Max subscription** or **API credits**.

## Implementations

### 1. Agent SDK Mode (Default)
**File:** [src/lib/claude-code-session.ts](src/lib/claude-code-session.ts)

Uses the official `@anthropic-ai/claude-agent-sdk` with streaming input mode for truly persistent sessions.

**Pros:**
- Battle-tested SDK implementation
- Optimal performance (~1.6s avg response time)
- Clean TypeScript API

**Cons:**
- Requires `ANTHROPIC_API_KEY`
- Uses API credits (pay-per-token)
- Cannot use Max subscription

**Performance:** 1.2-2.5s per message (1.6s average)

### 2. CLI Mode
**File:** [src/lib/claude-cli-session.ts](src/lib/claude-cli-session.ts)

Spawns a persistent Claude CLI process using `--print` mode with `stream-json` input/output format.

**Pros:**
- Uses your Max subscription (no additional API costs)
- Comparable performance to SDK
- Direct CLI integration

**Cons:**
- Requires `claude` CLI installed and authenticated
- Slightly more complex process management
- Depends on CLI stability

**Performance:** ~1.6-2.6s per message (comparable to SDK)

## Switching Between Modes

The **CLI mode (Max subscription) is the default**. Set the `USE_SDK` environment variable to switch:

```bash
# Use CLI mode (Max subscription) - default
npm run dev

# Use SDK mode (API credits)
export USE_SDK=true
npm run dev
```

## Performance Investigation

See [PERFORMANCE-INVESTIGATION.md](PERFORMANCE-INVESTIGATION.md) for detailed performance analysis of both approaches.

**Key findings:**
- Both modes achieve ~1.6s average response time
- CLI mode successfully maintains persistent session (no process recreation)
- SDK streaming mode was 5-10x faster than original `--print` per-message approach
- Remaining latency is model thinking time, not infrastructure overhead

## Check Status

Query the API endpoint to see which mode is active:

```bash
curl http://localhost:3000/api/claude-code
```

Response includes:
```json
{
  "status": "ready",
  "mode": "sdk",  // or "cli"
  "billing": "API credits",  // or "Max subscription"
  "hint": "..."
}
```

## Requirements

### For SDK Mode
- `ANTHROPIC_API_KEY` environment variable
- `@anthropic-ai/claude-agent-sdk` package installed

### For CLI Mode
- Claude Code CLI installed (`claude --version` should work)
- Authenticated via `claude setup-token` or Claude Max login
- `.claude/commands/modeler.md` file for system prompt

## Technical Details

### SDK Streaming Mode
Uses `AsyncIterable<SDKUserMessage>` generator pattern to maintain a single persistent query that accepts streamed messages:

```typescript
const messageStream = new MessageStream();
const query = query({
  prompt: messageStream.generate(),  // Async generator
  options: {...}
});

// Send messages by pushing to stream (no new processes!)
messageStream.pushMessage(content, sessionId);
```

### CLI Streaming Mode
Spawns Claude CLI with stream-json I/O and writes messages to stdin:

```bash
claude --print --verbose \
  --output-format stream-json \
  --input-format stream-json \
  --system-prompt "..."
```

Multiple messages can be streamed to the same process via stdin, avoiding the overhead of spawning new processes per message.

## Recommendation

- **Development:** Use SDK mode for consistency and reliability
- **Production with API budget:** Use SDK mode
- **Production with Max subscription:** Use CLI mode to reduce costs

Both implementations provide equivalent functionality and performance. The choice is primarily about billing preference.
