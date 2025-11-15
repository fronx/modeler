# MCP Server Setup for Cognitive Spaces

This guide explains how to set up the Cognitive Space MCP server for use with Claude Code.

## What is the MCP Server?

The MCP (Model Context Protocol) server exposes cognitive space operations as **native tools** for Claude Code, eliminating the need for cumbersome curl commands with complex JSON escaping.

## Features

### Tools (Operations)
- `create_space` - Create a new cognitive space
- `create_node` - Add a thought node to a space
- `delete_node` - Remove a node from a space
- `list_spaces` - List all cognitive spaces
- `get_space` - Get full details of a space

### Resources (Browsable Data)
- All cognitive spaces are exposed as `cognitive-space:///<spaceId>` resources
- Claude Code can list and read spaces directly

## Setup Instructions

### 1. Start the Servers

The MCP server now starts automatically with the dev server:

```bash
npm run dev
```

This runs both:
- Next.js dev server (port 3000) - cyan output
- MCP server (stdio) - magenta output

**Alternative:** Run them separately:
```bash
npm run dev:next  # Just Next.js
npm run dev:mcp   # Just MCP server
```

### 2. MCP Configuration (Already Done!)

The MCP server is already configured for this project:

**Files:**
- `.mcp.json` - MCP server definition
- `.claude/settings.local.json` - Permissions and auto-enable

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
    "allow": ["mcp__cognitive_spaces__*", ...]
  },
  "enableAllProjectMcpServers": true
}
```

### 3. Using the MCP Server

The wrapped Claude instance in this project will automatically:
1. Detect `.mcp.json` in the project root
2. Start the MCP server when needed
3. Make tools available with the `mcp__cognitive_spaces__` prefix

**No restart needed** - the MCP server starts on-demand when wrapped Claude needs it.

## Usage Examples

Once configured, wrapped Claude Code can use the tools directly:

### Create a Space

```
Use tool: create_space
{
  "title": "Project Planning",
  "description": "Planning the next quarter's roadmap"
}
```

### Create a Node

```
Use tool: create_node
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

### List All Spaces

```
Use tool: list_spaces
{}
```

### Browse Spaces as Resources

Wrapped Claude can also access spaces as MCP resources:

```
List resources: cognitive-space:///*
Read resource: cognitive-space:///2025-11-15T...
```

## Benefits Over Curl

### Before (with curl):
```bash
curl -s -X POST http://localhost:3000/api/spaces/SPACE_ID/thoughts \
  -H 'Content-Type: application/json' \
  -d '{"id":"Test","meanings":[{"content":"A test","confidence":0.9}],"focus":1.0}'
```

**Problems:**
- Permission denials for multi-line commands
- Complex JSON escaping
- No type safety or validation
- Hard to read and maintain

### After (with MCP):
```
Use tool: create_node
{
  "spaceId": "SPACE_ID",
  "id": "Test",
  "meanings": [{"content": "A test", "confidence": 0.9}],
  "focus": 1.0
}
```

**Advantages:**
- Native Claude Code integration
- JSON Schema validation
- Clean, readable syntax
- Type-safe parameters
- Automatic WebSocket updates

## Architecture

```
┌─────────────────┐
│  Wrapped Claude │
│   (Claude Code) │
└────────┬────────┘
         │ MCP Protocol (stdio)
         ↓
┌─────────────────┐
│   MCP Server    │
│  (mcp-server.ts)│
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│  Next.js API    │
│  (localhost:3000)│
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Turso Database │
│  + WebSocket    │
└─────────────────┘
```

## Troubleshooting

### MCP Server Not Appearing

1. Check Claude Code logs for MCP server startup errors
2. Verify the `cwd` path is correct in config
3. Ensure `npm run mcp` works when run manually
4. Check that the dev server is running on http://localhost:3000

### Tools Not Working

1. Verify the Next.js dev server is running (`npm run dev`)
2. Check the MCP server logs (they go to stderr)
3. Ensure database is initialized
4. Test the HTTP API directly with curl to isolate issues

### Database Connection Issues

The MCP server uses the same database configuration as the main app. Check:
- `.env` file has correct `DATABASE_URL` and `DATABASE_AUTH_TOKEN`
- Database is accessible
- Run `npx tsx test-turso.ts` to verify database connection

## Development

To modify the MCP server:

1. Edit [mcp-server.ts](mcp-server.ts)
2. Restart the MCP server (Claude Code will auto-restart it)
3. Test with wrapped Claude

The server is designed to be stateless and handle all operations via HTTP to the Next.js API, ensuring consistency with the web dashboard.
