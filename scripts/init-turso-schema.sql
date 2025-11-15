-- Turso Database Schema for Cognitive Modeling System
-- Phase 1: Normalized relational schema (spaces, nodes, history)

-- Spaces: Just metadata, no embedded data
-- Includes vector embeddings for semantic search (Phase 2)
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,     -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL,
    title_embedding F32_BLOB(768),           -- Vector for title semantic search
    description_embedding F32_BLOB(768)      -- Vector for description semantic search
);

CREATE INDEX IF NOT EXISTS spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX IF NOT EXISTS spaces_updated_at_idx ON spaces (updated_at DESC);

-- Nodes: Each node is a separate row
-- Includes vector embeddings for semantic search (Phase 2)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,                 -- Generated: `${space_id}:${node_key}`
    space_id TEXT NOT NULL,
    node_key TEXT NOT NULL,              -- e.g., "DirectTransmission" (user identifier)
    data TEXT NOT NULL,                  -- JSON: meanings, values, relationships, etc.
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    title_embedding F32_BLOB(768),       -- Vector for node title/ID semantic search
    full_embedding F32_BLOB(768),        -- Vector for full content semantic search
    UNIQUE(space_id, node_key),          -- Each space has its own namespace
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS nodes_space_id_idx ON nodes(space_id);
CREATE INDEX IF NOT EXISTS nodes_updated_at_idx ON nodes(updated_at DESC);

-- History: One row per history entry
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,                 -- Generated UUID or composite key
    space_id TEXT NOT NULL,
    entry TEXT NOT NULL,                 -- The history message
    created_at INTEGER NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS history_space_id_idx ON history(space_id);
CREATE INDEX IF NOT EXISTS history_created_at_idx ON history(created_at DESC);

-- Claude CLI Sessions: Track conversation sessions for resume functionality
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                 -- Claude CLI session ID (UUID)
    title TEXT,                          -- Optional user-provided title
    space_id TEXT,                       -- Associated cognitive space (if any)
    message_count INTEGER DEFAULT 0,     -- Number of messages in conversation
    created_at INTEGER NOT NULL,         -- Unix timestamp (ms)
    last_used_at INTEGER NOT NULL,       -- Last activity timestamp
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sessions_last_used_idx ON sessions(last_used_at DESC);
CREATE INDEX IF NOT EXISTS sessions_space_id_idx ON sessions(space_id);

-- Edges: First-class relationships between thought nodes
-- Enables graph analytics, semantic flow analysis, and referential integrity
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,              -- Generated: "${spaceId}:${sourceNode}:${targetNode}"
  space_id TEXT NOT NULL,
  source_node TEXT NOT NULL,        -- Node key (e.g., "Trust")
  target_node TEXT NOT NULL,        -- Node key (e.g., "Evidence")
  type TEXT NOT NULL,               -- 'supports' | 'conflicts-with' | 'relates-to'
  strength REAL NOT NULL,           -- 0.0 to 1.0
  gloss TEXT,                       -- Optional description
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,      -- Unix timestamp (ms)

  UNIQUE(space_id, source_node, target_node),
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id, source_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE,
  FOREIGN KEY (space_id, target_node) REFERENCES nodes(space_id, node_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS edges_space_source_idx ON edges(space_id, source_node);
CREATE INDEX IF NOT EXISTS edges_space_target_idx ON edges(space_id, target_node);
CREATE INDEX IF NOT EXISTS edges_type_idx ON edges(space_id, type);

-- Vector search indices (Phase 2: Vector Search)
-- Using float8 compression for neighbors reduces index size with minimal quality impact
CREATE INDEX IF NOT EXISTS spaces_title_vec_idx ON spaces (
  libsql_vector_idx(title_embedding,
    'metric=cosine',
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);

CREATE INDEX IF NOT EXISTS spaces_description_vec_idx ON spaces (
  libsql_vector_idx(description_embedding,
    'metric=cosine',
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);

CREATE INDEX IF NOT EXISTS nodes_title_embedding_idx ON nodes (
  libsql_vector_idx(title_embedding,
    'metric=cosine',
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);

CREATE INDEX IF NOT EXISTS nodes_full_embedding_idx ON nodes (
  libsql_vector_idx(full_embedding,
    'metric=cosine',
    'compress_neighbors=float8',
    'max_neighbors=20'
  )
);
