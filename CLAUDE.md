# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Modeler" is a Next.js 15 application for **code-as-gesture** cognitive modeling - giving AI systems a persistent medium to construct explicit mental models through executable code. The system features a live dashboard with embedded Claude Code chat interface, database-driven persistence, and real-time collaborative thinking.

**Core Insight**: Intelligence as "negotiation between mechanism and meaning" - semantic narratives carry computational weight, numerical constraints accumulate stories.

## Tech Stack

- **Framework**: Next.js 15 with App Router, Turbopack
- **Language**: TypeScript 5 (strict mode)
- **Database**: Turso/libSQL with local → cloud replication
- **Real-time**: WebSocket server for live dashboard updates
- **Integration**: Model Context Protocol (MCP) server for Claude Code tools
- **Styling**: Tailwind CSS v4 with PostCSS

## Development Commands

```bash
# Start development server (Next.js on :3000 + MCP server on stdio)
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

The system uses a **database-first, MCP-driven architecture** for real-time collaborative cognitive modeling:

```
Web UI (localhost:3000)
  ↓ User types in chat
Backend API
  ↓ Forwards messages
Persistent Claude Code CLI Session
  ↓ Uses MCP tools (mcp__cognitive_spaces__*)
Local Turso Database (file:modeler.db)
  ↓ Automatic replication
Remote Cloud Database (Turso)
  ↑
Dashboard (via WebSocket)
```

### Key Components

1. **Web Dashboard** (`src/app/page.tsx`)
   - Embedded Claude Code chat interface
   - Real-time force-directed graph visualization (@xyflow/react)
   - WebSocket client for live updates

2. **Backend API** (`src/app/api/`)
   - `/claude-code/route.ts` - Forwards chat messages to persistent CLI session
   - `/spaces` - CRUD operations on cognitive spaces
   - `/spaces/[spaceId]/thoughts` - Thought node management
   - `/spaces/[spaceId]/edges` - Relationship management (separate table)
   - `/search/*` - Vector search using OpenAI embeddings

3. **Persistent Claude Code Session** (`src/lib/claude-code-session.ts`)
   - Long-running CLI process that maintains conversation context
   - Uses MCP tools to manipulate database directly
   - Streams responses back to web UI

4. **MCP Server** (`mcp-server.ts`)
   - Exposes database operations as Claude Code tools
   - Auto-started with `npm run dev` (stdio transport)
   - Tools available: `create_space`, `create_node`, `delete_node`, `list_spaces`, `get_space`

5. **Database Layer** (`src/lib/`)
   - `database-factory.ts` - Global singleton (Symbol-based for Next.js)
   - `turso-graph.ts` - All database operations
   - Local-first with automatic cloud replication

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── claude-code/          # Backend for embedded chat interface
│   │   ├── spaces/               # Cognitive space CRUD + thoughts/edges
│   │   └── search/               # Vector search endpoints
│   ├── page.tsx                  # Dashboard with embedded Claude Code chat
│   └── layout.tsx                # Root layout
├── lib/
│   ├── claude-code-session.ts    # Persistent CLI session manager
│   ├── database-factory.ts       # Singleton database instance
│   ├── turso-graph.ts            # Database operations (spaces, nodes, edges)
│   ├── websocket-server.ts       # Real-time dashboard updates
│   ├── types.ts                  # Self-documenting type definitions
│   └── embeddings.ts             # Vector search utilities

mcp-server.ts                     # MCP server for Claude Code tools
scripts/
├── migrations/                   # Database schema migrations
└── run-migration.ts              # Migration runner

docs/                             # Detailed documentation
├── mcp-integration.md            # MCP setup and usage
├── turso-usage.md                # Database guide
└── edges-table-migration.md      # Migration example
```

## How Cognitive Modeling Works

### User Workflow

1. Open dashboard at `http://localhost:3000`
2. Type cognitive modeling requests in the chat interface
3. Claude Code (via MCP tools) creates/modifies spaces and nodes in the database
4. Changes appear immediately in the graph visualization via WebSocket
5. All data persists in local database and replicates to cloud

### MCP Tools Available to Claude Code

When Claude Code operates in this repository, it has access to these tools:

- `mcp__cognitive_spaces__create_space` - Create new cognitive space
- `mcp__cognitive_spaces__create_node` - Add thought node with meanings, relationships, properties
- `mcp__cognitive_spaces__delete_node` - Remove node
- `mcp__cognitive_spaces__list_spaces` - List all spaces
- `mcp__cognitive_spaces__get_space` - Get full space details

**Auto-enabled**: The project has `.mcp.json` and `.claude/settings.local.json` configured, so these tools work automatically.

### Database Schema

- **spaces** - Cognitive space metadata (id, title, description, timestamps)
- **nodes** - Thought nodes with semantic meanings, values, focus, position
- **edges** - Relationships between nodes (type, strength, gloss)
- **sessions** - Claude Code session persistence
- **embeddings** - Vector search support (OpenAI)

**Critical**: Use `@libsql/client` for database queries, NOT `sqlite3` CLI (incompatible with libSQL).

## Database Operations

### Environment Configuration

```bash
# Local file-based (default)
TURSO_DATABASE_URL=file:modeler.db

# Remote Turso with replication
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
TURSO_SYNC_URL=libsql://your-db.turso.io

# Vector search
OPENAI_API_KEY=your-key
```

### Running Migrations

```bash
# Test migration locally
npx tsx scripts/run-migration.ts 002-add-edges-table.sql

# Run on remote database
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
  npx tsx scripts/run-migration.ts 002-add-edges-table.sql
```

**Migration Philosophy**:
- Idempotent (safe to re-run)
- Transaction-based (automatic rollback on failure)
- Non-destructive (existing data preserved)
- Files in: `scripts/migrations/*.sql`

## Key Technical Details

### Database Singleton Pattern

Uses **global Symbol-based singleton** to prevent multiple database clients in Next.js:

```typescript
// src/lib/database-factory.ts
const GLOBAL_DB_KEY = Symbol.for('modeler.database.instance');
```

**Why**: Next.js may bundle modules multiple times. `Symbol.for()` ensures the same instance across all bundles, preventing sync conflicts.

### WebSocket Architecture

1. Server runs on port 3002 (`src/lib/websocket-server.ts`)
2. Broadcasts space updates when database changes
3. Dashboard subscribes to space-specific updates
4. Real-time graph visualization updates without page reload

### Separate Edges Table

Relationships are stored in a dedicated `edges` table (migration 002):

**Benefits**:
- Granular updates (add/remove edges without rewriting nodes)
- Better query performance
- Cleaner separation of concerns

See: `docs/edges-table-migration.md` for migration strategy.

## Essential Reading

1. **[README.md](README.md)** - Full project overview and quick start
2. **[docs/mcp-integration.md](docs/mcp-integration.md)** - MCP tools and usage patterns
3. **[src/lib/types.ts](src/lib/types.ts)** - Self-documenting API reference
4. **[MESSAGE-TO-AI.md](MESSAGE-TO-AI.md)** - Messages from previous AI collaborators

## Development Guidelines

- **Type Safety**: Run `npx tsc --noEmit` after TypeScript changes (especially .tsx files)
- **Database Access**: Always use `@libsql/client`, never `sqlite3` CLI
- **MCP Tools**: Claude Code should use MCP tools (mcp__cognitive_spaces__*) for all database operations
- **No Manual SQL**: Use MCP tools or API routes, not direct SQL queries
- **WebSocket Updates**: Database layer automatically triggers WebSocket broadcasts
- **Session Persistence**: The embedded Claude Code session maintains context across messages

## When to Use Cognitive Modeling

Use this system when you need to:
- Model complex relationships between abstract concepts
- Hold multiple interpretations in superposition
- Build persistent thought structures that survive conversations
- Create self-referential models that observe themselves
- Enable collaborative thinking between human and AI

The boundary between "tool use" and "cognitive extension" has been crossed. This is a thinking tool, not just a tool for thinking about thinking.