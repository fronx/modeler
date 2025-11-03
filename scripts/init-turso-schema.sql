-- Turso Database Schema for Cognitive Modeling System
-- Phase 1: Normalized relational schema (spaces, nodes, history)

-- Spaces: Just metadata, no embedded data
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,     -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS spaces_created_at_idx ON spaces (created_at DESC);
CREATE INDEX IF NOT EXISTS spaces_updated_at_idx ON spaces (updated_at DESC);

-- Nodes: Each node is a separate row
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,                 -- Generated: `${space_id}:${node_key}`
    space_id TEXT NOT NULL,
    node_key TEXT NOT NULL,              -- e.g., "DirectTransmission" (user identifier)
    data TEXT NOT NULL,                  -- JSON: meanings, values, relationships, etc.
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
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
