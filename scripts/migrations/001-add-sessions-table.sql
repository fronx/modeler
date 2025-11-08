-- Migration 001: Add sessions table for Claude CLI session tracking
-- Run this migration to add session resume functionality
-- Usage: npx tsx scripts/run-migration.ts 001-add-sessions-table.sql

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
