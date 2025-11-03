-- Turso Vector Embeddings Schema Migration
-- Phase 2: Add vector search capabilities to existing schema
-- Uses 768-dimensional F32_BLOB vectors for OpenAI text-embedding-3-small

-- Add vector embeddings to spaces table for semantic space search
ALTER TABLE spaces ADD COLUMN title_embedding F32_BLOB(768);
ALTER TABLE spaces ADD COLUMN description_embedding F32_BLOB(768);

-- Create vector indices for fast similarity search on spaces
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

-- Add vector embeddings to nodes table for semantic node search
-- title_embedding: Quick lookup based on node ID/title (e.g., "DirectTransmission")
-- full_embedding: Rich semantic search including meanings, values, relationships
ALTER TABLE nodes ADD COLUMN title_embedding F32_BLOB(768);
ALTER TABLE nodes ADD COLUMN full_embedding F32_BLOB(768);

-- Create vector indices for fast similarity search on nodes
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

-- Notes:
-- - F32_BLOB(768): Matches OpenAI text-embedding-3-small with 768 dimensions
-- - metric=cosine: Use cosine distance (1 - cosine similarity), range 0-2
-- - compress_neighbors=float8: Compress index structure (not main data) for speed
-- - max_neighbors=20: Balance between search accuracy and performance
-- - Embeddings generated eagerly on space/node insert/update
