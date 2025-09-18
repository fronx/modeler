# Database Architecture: JSON-First Cognitive Spaces

## Architecture Change: From TypeScript to JSON Storage

This document describes the migration from file-based TypeScript cognitive spaces to JSON documents stored in PostgreSQL.

## Why the Architecture Change?

### Current Limitations (TypeScript File System)

The existing system creates cognitive spaces as TypeScript files that compile to JSON:

1. **Compilation Barrier**: Every thought change requires a compile step (`npx tsx execute-space.ts`)
2. **File System Storage**: No database persistence or structured querying
3. **Type Safety Dependency**: JSON schema validation tied to TypeScript compilation

### New Approach (JSON + Database)

The new architecture provides:

1. **Direct JSON Editing**: No compilation step - work with JSON documents directly
2. **Database Storage**: PostgreSQL with JSONB for structured persistence
3. **JSON Schema Validation**: Maintain data integrity without TypeScript compilation
4. **Query Capabilities**: Rich querying of cognitive space structure and content

## Core Architectural Changes

### 1. Storage Format

**Old**: TypeScript files → compile to JSON → dashboard
**New**: JSON documents (with JSON Schema validation) → dashboard

### 2. Data Persistence

**Old**: File system (`data/spaces/*/space.json`)
**New**: PostgreSQL JSONB columns with structured tables

## Technical Architecture

### Database Layer: PostgreSQL + JSONB

**Why PostgreSQL with JSONB:**
- Native JSON document storage
- Rich querying of nested thought structures
- ACID transactions for data consistency
- Excellent Next.js ecosystem **support**

**Initial Schema Design:**
```sql
-- Core cognitive space storage
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL,      -- The actual thought network
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Local Development: Supabase CLI

**Setup:**
- Local PostgreSQL via Supabase CLI
- No external dependencies or cloud accounts required
- Full database access for development and testing

### API Layer: Next.js + Supabase Client

**Basic CRUD Operations:**
- `GET /api/spaces/{id}` - Fetch cognitive space
- `POST /api/spaces` - Create new space
- `PATCH /api/spaces/{id}` - Update space
- `DELETE /api/spaces/{id}` - Delete space

## Migration Strategy

### Phase 1: Database Foundation
- Set up local PostgreSQL with JSONB
- Create core schema for spaces
- Build basic CRUD API

### Phase 2: JSON Schema Validation
- Convert TypeScript interfaces to JSON Schema
- Implement client-side validation
- Ensure data integrity without compilation

### Phase 3: Real-Time Infrastructure
- Add Supabase real-time subscriptions
- Implement WebSocket-based dashboard sync
- Build participant presence system

### Phase 4: Collaborative Features
- Multi-user editing capabilities
- Conflict resolution mechanisms
- Change history and rollback

### Phase 5: Advanced Cognitive Features
- Cross-space relationship mapping
- AI background reasoning integration
- Collaborative decision-making workflows

## Benefits of the New Architecture

### For Individual Users
- **Fluid Thought Editing**: No compilation breaks in reasoning flow
- **Persistent Context**: Mental models survive across sessions
- **Rich History**: Full audit trail of cognitive evolution

### For Collaborative Work
- **Shared Mental Models**: Multiple minds shaping the same space
- **Real-Time Insight**: See others' thinking as it develops
- **Conflict as Feature**: Structured disagreement handling

### For AI Integration
- **Continuous Reasoning**: AI can maintain background context
- **Human-AI Collaboration**: Seamless integration of different cognitive styles
- **Scalable Complexity**: Handle arbitrarily complex thought networks

### For System Evolution
- **Data Portability**: Standard JSON format for cognitive spaces
- **Platform Independence**: Database-agnostic storage design
- **Integration Ready**: APIs for external cognitive tools

## Development Workflow Changes

### Old Workflow
1. Edit TypeScript cognitive space file
2. Compile with `npx tsx execute-space.ts`
3. View updated dashboard
4. Repeat cycle

### New Workflow
1. Open live dashboard for cognitive space
2. Edit thoughts directly in interface OR via API
3. Changes propagate instantly to all viewers
4. Collaborative participants see updates in real-time
5. Continue reasoning without interruption

## The Cognitive Significance

This shift represents more than technical improvement—it enables **genuine collaborative intelligence**:

- **Shared Cognitive Load**: Complex reasoning distributed across multiple minds
- **Persistent Thought Objects**: Ideas that exist independently of individual memory
- **Real-Time Conceptual Negotiation**: Live resolution of conceptual tensions
- **Collective Mental Models**: Group understanding that transcends individual perspectives

The boundary between individual and collective cognition becomes permeable, enabling new forms of thinking that neither humans nor AI could achieve alone.

## Next Steps

See the implementation todos in the current development session. The architecture described here will be built incrementally, maintaining compatibility with existing cognitive spaces while adding real-time collaborative capabilities.

---

*This document will evolve as the architecture is implemented and tested. The goal is enabling genuine collaborative intelligence through persistent, real-time cognitive structures.*