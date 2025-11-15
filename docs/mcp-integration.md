# MCP Integration for Cognitive Spaces

## Overview

The Modeler project now includes a **Model Context Protocol (MCP)** server that exposes cognitive space operations as native tools for Claude Code. This eliminates the need for cumbersome curl commands with complex JSON escaping.

## What Changed

### 1. WebSocket Broadcast Fix
- **Issue**: Nodes created via API didn't appear in dashboard without page reload
- **Fix**: Added `broadcast(spaceId)` call to POST `/thoughts` route
- **Location**: [src/app/api/spaces/[spaceId]/thoughts/route.ts](../src/app/api/spaces/[spaceId]/thoughts/route.ts)

### 2. MCP Server Implementation
- **File**: [mcp-server.ts](../mcp-server.ts)
- **Package**: `@modelcontextprotocol/sdk@1.22.0`
- **Protocol**: Stdio-based communication with Claude Code

### 3. Concurrent Server Startup
- **Change**: `npm run dev` now starts both Next.js and MCP server
- **Tool**: Uses `concurrently` to run multiple processes
- **Output**: Color-coded (cyan=Next.js, magenta=MCP)

## Available Tools

### `create_space`
Create a new cognitive space.

**Parameters:**
- `title` (string) - Space title
- `description` (string) - What this space explores

**Example:**
```json
{
  "title": "Project Planning",
  "description": "Planning the next quarter's roadmap"
}
```

### `create_node`
Add a thought node to a cognitive space.

**Parameters:**
- `spaceId` (string, required) - Space ID
- `id` (string, required) - Node identifier
- `meanings` (array) - Semantic meanings `[{content, confidence}]`
- `focus` (number) - Visibility: 1.0=visible, 0.0=neutral, -1.0=hidden
- `semanticPosition` (number) - Position: -1.0=left, 0.0=center, 1.0=right
- `values` (object) - Key-value properties
- `relationships` (array) - Relationships `[{type, target, strength}]`
- `checkableList` (array) - Checklist items `[{item, checked}]`
- `regularList` (array) - Regular list items (strings)

**Example:**
```json
{
  "spaceId": "2025-11-15T...",
  "id": "Q1 Goals",
  "meanings": [
    {"content": "First quarter objectives", "confidence": 0.9}
  ],
  "focus": 1.0,
  "semanticPosition": 0.0,
  "checkableList": [
    {"item": "Define OKRs", "checked": false},
    {"item": "Align with stakeholders", "checked": false}
  ]
}
```

### `delete_node`
Remove a node from a space.

**Parameters:**
- `spaceId` (string) - Space ID
- `nodeId` (string) - Node ID to delete

### `list_spaces`
List all cognitive spaces.

**Parameters:** None

**Returns:** List of spaces with titles and IDs

### `get_space`
Get full details of a cognitive space.

**Parameters:**
- `spaceId` (string) - Space ID

**Returns:** Complete space JSON

## MCP Resources

All cognitive spaces are exposed as browsable resources:

- **URI Pattern**: `cognitive-space:///<spaceId>`
- **MIME Type**: `application/json`
- **Operations**: List, Read

Wrapped Claude can browse and read spaces directly without using tools.

## Configuration for Wrapped Claude

### Project-Local Configuration (Already Done!)

The MCP server is already configured for this project through local configuration files:

**Files:**
1. **[.mcp.json](../.mcp.json)** - MCP server definition
2. **[.claude/settings.local.json](../.claude/settings.local.json)** - Permissions and auto-enable

**Configuration:**
```json
// .mcp.json
{
  "mcpServers": {
    "cognitive-spaces": {
      "command": "npm",
      "args": ["run", "mcp"],
      "env": {
        "MODELER_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Permissions:**
```json
// .claude/settings.local.json
{
  "permissions": {
    "allow": [
      "mcp__cognitive_spaces__*",
      ...
    ]
  },
  "enableAllProjectMcpServers": true
}
```

### How It Works

When the wrapped Claude Code instance runs in this project:

1. **Detection**: Claude Code detects `.mcp.json` in the project root
2. **Auto-start**: MCP server starts on-demand when tools are first used
3. **Tool Availability**: Tools appear with `mcp__cognitive_spaces__` prefix:
   - `mcp__cognitive_spaces__create_space`
   - `mcp__cognitive_spaces__create_node`
   - `mcp__cognitive_spaces__delete_node`
   - `mcp__cognitive_spaces__list_spaces`
   - `mcp__cognitive_spaces__get_space`

**No restart needed** - the configuration is already in place and works automatically.

### Alternative: Global Configuration

For use outside this project, add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "cognitive-spaces": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/Users/fnx/code/modeler",
      "env": {
        "MODELER_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then restart Claude Code to load the MCP server.

## Architecture

```
┌─────────────────────┐
│  Wrapped Claude     │
│  (Claude Code)      │
└──────────┬──────────┘
           │ MCP Protocol (stdio)
           ↓
┌─────────────────────┐
│   MCP Server        │
│  (mcp-server.ts)    │
└──────────┬──────────┘
           │ HTTP (localhost:3000)
           ↓
┌─────────────────────┐
│  Next.js API        │
│  + WebSocket Server │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Turso Database     │
│  (libSQL)           │
└─────────────────────┘
```

## Development Workflow

### Before (with curl)
```bash
curl -X POST http://localhost:3000/api/spaces/SPACE_ID/thoughts \
  -H 'Content-Type: application/json' \
  -d '{"id":"Test","meanings":[{"content":"A test","confidence":0.9}],"focus":1.0}'
```

**Issues:**
- Multi-line commands get permission denials
- Complex JSON escaping required
- No type safety or validation
- Error-prone and hard to read

### After (with MCP)
```
Use tool: create_node
{
  "spaceId": "SPACE_ID",
  "id": "Test",
  "meanings": [{"content": "A test", "confidence": 0.9}],
  "focus": 1.0
}
```

**Benefits:**
- Native Claude Code tool integration
- Clean, readable JSON
- JSON Schema validation
- Type-safe parameters
- Automatic WebSocket updates

## Testing

### Test MCP Server Standalone
```bash
npm run mcp
```

Should output:
```
Cognitive Space MCP server running on stdio
```

### Test with Development Server
```bash
npm run dev
```

Should show both servers starting:
- `[next]` - Next.js dev server
- `[mcp]` - MCP server

## Files Modified

1. **package.json** - Added scripts and concurrently dependency
2. **src/app/api/spaces/[spaceId]/thoughts/route.ts** - Added WebSocket broadcast
3. **mcp-server.ts** - New MCP server implementation
4. **MCP-SETUP.md** - Configuration guide
5. **CLAUDE.md** - Updated project instructions

## Next Steps

1. Configure wrapped Claude to use the MCP server
2. Test creating nodes using MCP tools
3. Verify WebSocket updates work in real-time
4. Consider adding more MCP tools (update node, search, etc.)

## Troubleshooting

### MCP Server Not Appearing in Claude Code
- Check Claude Code logs for startup errors
- Verify `cwd` path in MCP config is correct
- Ensure `npm run mcp` works standalone
- Confirm Next.js server is running on port 3000

### Tools Not Working
- Verify both servers are running (`npm run dev`)
- Check MCP server logs (stderr output)
- Test HTTP API directly with curl to isolate issues
- Ensure database is initialized

### Database Connection Issues
- Check `.env` file has correct `DATABASE_URL` and `DATABASE_AUTH_TOKEN`
- Run `npx tsx test-turso.ts` to verify database connection
- Check database factory logs for initialization errors

## References

- [MCP-SETUP.md](../MCP-SETUP.md) - Detailed setup instructions
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
