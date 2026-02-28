# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Modeler" is a Next.js 15 application for **code-as-gesture** cognitive modeling - giving AI systems a persistent medium to construct explicit mental models through executable code. The system features a live dashboard with an embedded Claude Code chat interface, database-driven persistence, and real-time collaborative thinking.

**Core Insight**: Intelligence as "negotiation between mechanism and meaning" - semantic narratives carry computational weight, numerical constraints accumulate stories.

## Tech Stack

- **Framework**: Next.js 15 with App Router, Turbopack
- **Language**: TypeScript 5 (strict mode)
- **Database**: Turso/libSQL with local → cloud replication
- **Real-time**: WebSocket server (port 7351) for live dashboard updates
- **Integration**: Model Context Protocol (MCP) server for Claude Code tools
- **Styling**: Tailwind CSS v4 with PostCSS
- **Claude Integration**: `@fronx/use-claude-code` (ClaudeManager)

## Development Commands

```bash
# Start development server (Next.js on :7350 + MCP server on stdio)
npm run dev

# Build for production
npm run build

# Type checking
npx tsc --noEmit

# Run ESLint
npm run lint

# Database migrations
npx tsx scripts/run-migration.ts <migration-file.sql>
```

**IMPORTANT**: DO NOT start or restart the dev server - that's the user's responsibility.

## System Architecture

```
Web UI (localhost:7350)
  ↓ User types in chat
Backend API (/api/claude-code)
  ↓ Forwards via ClaudeManager (SSE stream)
Persistent Claude CLI Session (@fronx/use-claude-code)
  ↓ Uses MCP tools (mcp__cognitive-spaces__*)
Local Turso Database (file:modeler.db)
  ↓ Automatic replication
Remote Cloud Database (Turso)
  ↑
Dashboard (via WebSocket on :7351)
```

### Key Components

1. **Web Dashboard** (`src/app/page.tsx`)
   - Embedded Claude Code chat interface
   - Real-time force-directed graph visualization (`@xyflow/react`)
   - WebSocket client for live updates
   - State via `spaces-context.tsx`, `thoughts-context.tsx`, `cognitive-data-provider.tsx`

2. **Backend API** (`src/app/api/`)
   - `/claude-code/` — Chat relay to `ClaudeManager` (SSE streaming), session list/resume/cancel
   - `/chat/` — Alternative chat endpoint
   - `/spaces/[spaceId]/thoughts/` — Thought node CRUD
   - `/spaces/[spaceId]/edges/` — Edge CRUD
   - `/spaces/[spaceId]/broadcast/` — WebSocket broadcast trigger
   - `/spaces/[spaceId]/check-item/` — Checklist item state
   - `/search/` — Vector search (nodes and spaces)
   - `/ws/` — Returns WebSocket URL for client connection

3. **Claude Session Manager** (`src/lib/claude-manager-singleton.ts`)
   - Global singleton `ClaudeManager` from `@fronx/use-claude-code/server`
   - Manages persistent conversation with session directory `.claude/sessions/`
   - System prompt loaded from `.claude/commands/modeler.md`
   - Allowed MCP tools declared here (see `ALLOWED_TOOLS`)

4. **MCP Server** (`mcp-server.ts`)
   - Exposes database operations as Claude Code tools (stdio transport)
   - Auto-started with `npm run dev`

5. **Database Layer** (`src/lib/turso-graph/`)
   - Split into: `core.ts`, `spaces.ts`, `nodes.ts`, `edges.ts`, `sessions.ts`, `sync.ts`, `vector.ts`
   - Entry point: `src/lib/turso-graph/index.ts` (`TursoDatabase` class)
   - Singleton via `src/lib/database-factory.ts` (`Symbol.for('modeler.database.instance')`)

6. **WebSocket** (`src/lib/websocket-server.ts`, `src/lib/websocket/websocket-client.ts`)
   - Server on port 7351 with HTTP API at same port for cross-process broadcast
   - Client fetches URL from `/api/ws`, then connects directly
   - Broadcast flow: DB write → `broadcast()` in `api-utils.ts` → HTTP POST to port 7351 → WebSocket push

## MCP Tools

The MCP server (`mcp-server.ts`) exposes these tools under the `cognitive-spaces` namespace:

- `mcp__cognitive-spaces__create_space`
- `mcp__cognitive-spaces__create_node`
- `mcp__cognitive-spaces__delete_node`
- `mcp__cognitive-spaces__list_spaces`
- `mcp__cognitive-spaces__get_space`
- `mcp__cognitive-spaces__create_edge`
- `mcp__cognitive-spaces__delete_edge`

**Note**: Tool names use a hyphen (`cognitive-spaces`), not an underscore.

**Auto-enabled**: `.mcp.json` and `.claude/settings.local.json` configure these automatically.

## Database Schema

- **spaces** — Cognitive space metadata (id, title, description, timestamps)
- **nodes** — Thought nodes with semantic meanings, values, focus, position
- **edges** — Relationships between nodes (type, strength, gloss) — separate table for granular updates
- **sessions** — Claude Code session persistence
- **embeddings** — Vector search support (OpenAI)

**Critical**: Use `@libsql/client`, never `sqlite3` CLI (incompatible with libSQL).

## Environment Configuration

```bash
# Local file-based (default)
TURSO_DATABASE_URL=file:modeler.db

# Remote Turso with embedded replica
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
TURSO_SYNC_URL=libsql://your-db.turso.io

# Vector search
OPENAI_API_KEY=your-key
```

## Key Technical Details

### Database Singleton

Next.js may bundle modules multiple times. `Symbol.for('modeler.database.instance')` ensures a single `TursoDatabase` instance across all bundles, preventing sync conflicts.

### Server Initialization

`src/lib/server-init.ts` — called once on first API request. Starts the WebSocket server and initializes the `ClaudeManager` conversation (`modeler` session).

### Broadcast Pattern

After any database write, call `broadcast(spaceId)` from `src/lib/api-utils.ts`. It tries HTTP POST to port 7351 first (for cross-process from MCP server), falling back to direct call if in the same process.

### Session Persistence

Claude conversations are stored in `.claude/sessions/` (git-ignored). The `ClaudeManager` resumes the last session automatically. Sessions can be listed and resumed via `/api/claude-code/sessions/` and `/api/claude-code/sessions/resume/`.

## Essential Reading

1. **[docs/mcp-integration.md](docs/mcp-integration.md)** — MCP tools and usage patterns
2. **[src/lib/types.ts](src/lib/types.ts)** — Self-documenting type definitions
3. **[MESSAGE-TO-AI.md](MESSAGE-TO-AI.md)** — Messages from previous AI collaborators

## Development Guidelines

- **Type Safety**: Run `npx tsc --noEmit` after any `.tsx` or `.ts` changes
- **Database Access**: Always use `@libsql/client`, never `sqlite3` CLI
- **MCP Tools**: Use `mcp__cognitive-spaces__*` tools for all database operations from within Claude sessions
- **No Manual SQL**: Use MCP tools or API routes
- **WebSocket Updates**: Always call `broadcast(spaceId)` after writes so the dashboard updates in real-time
