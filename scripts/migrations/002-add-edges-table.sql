-- Migration 002: Add edges table for first-class relationship storage
-- Run this migration to enable efficient graph queries and prevent orphaned edges
-- Usage: npx tsx scripts/run-migration.ts 002-add-edges-table.sql

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

-- Index for querying outgoing edges from a node
CREATE INDEX IF NOT EXISTS edges_space_source_idx ON edges(space_id, source_node);

-- Index for querying incoming edges to a node
CREATE INDEX IF NOT EXISTS edges_space_target_idx ON edges(space_id, target_node);

-- Index for filtering edges by type (supports, conflicts-with, etc.)
CREATE INDEX IF NOT EXISTS edges_type_idx ON edges(space_id, type);
