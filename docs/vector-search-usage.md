# Vector Search Usage Guide

Phase 2 of the Turso integration adds semantic search capabilities to cognitive spaces using vector embeddings.

## Quick Start

### 1. Setup

```bash
# Ensure Turso database is configured
export DATABASE_TYPE=turso
export TURSO_DATABASE_URL="file:modeler.db"  # or remote URL

# Enable vector search
export ENABLE_VECTOR_SEARCH=true

# Configure embedding generation (currently uses OpenAI)
export OPENAI_API_KEY="your-openai-api-key"
```

### 2. Migrate Existing Database

If you have an existing Turso database from Phase 1, run the migration:

```bash
npx tsx scripts/migrate-add-vectors.ts
```

This adds vector embedding columns and indices to your schema.

### 3. Test Vector Search

```bash
npx tsx test-vector-search.ts
```

## How It Works

### Automatic Embedding Generation

When `ENABLE_VECTOR_SEARCH=true`, embeddings are **automatically generated** on space creation/update:

- **Space embeddings**: Generated from title and description
- **Node embeddings**:
  - `title_embedding`: From node ID (e.g., "DirectTransmission" → "Direct Transmission")
  - `full_embedding`: From full semantic content (meanings, values, relationships)

### Embedding Details

- **Model**: OpenAI `text-embedding-3-small` (configurable to 768 dimensions)
- **Storage**: F32_BLOB(768) in Turso - 4 bytes per dimension
- **Batching**: Multiple texts embedded in single API call for efficiency
- **Error handling**: Embedding failures don't block space creation

## API Endpoints

### Search Spaces

Find cognitive spaces by semantic similarity:

```bash
GET /api/search/spaces?q=belief+and+evidence&limit=5
```

**Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results (default: 10)

**Response:**
```json
{
  "query": "belief and evidence",
  "results": [
    {
      "id": "space-123",
      "title": "Trust and Evidence",
      "description": "...",
      "similarity": 0.87,
      "distance": 0.26
    }
  ],
  "count": 1
}
```

### Search Nodes (Global)

Find nodes across all spaces:

```bash
GET /api/search/nodes?q=information+processing&limit=10&threshold=0.5
```

**Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results (default: 10)
- `threshold` (optional): Min similarity 0-1 (default: 0.5)

### Search Nodes (Space-specific)

Find nodes within a specific space:

```bash
GET /api/search/nodes?q=cognitive+shortcuts&spaceId=space-123&limit=5
```

**Additional parameter:**
- `spaceId` (optional): Restrict search to this space

## Programmatic Usage

### TursoDatabase Methods

```typescript
import { TursoDatabase } from '@/lib/turso-database';

const db = new TursoDatabase({ enableVectorSearch: true });

// Search spaces
const spaces = await db.searchSpaces('learning and memory', 5);

// Search all nodes
const allNodes = await db.searchAllNodes('trust without evidence', 10, 0.6);

// Search within specific space
const spaceNodes = await db.searchNodesInSpace(
  'space-id',
  'information retrieval',
  5,
  0.5
);
```

## Understanding Results

### Similarity Score (0-1)

- **1.0**: Identical semantic meaning
- **0.8-1.0**: Very similar concepts
- **0.6-0.8**: Related concepts
- **0.4-0.6**: Loosely related
- **< 0.4**: Different concepts

The `threshold` parameter filters out results below the minimum similarity.

### Distance (0-2)

Raw cosine distance from Turso:
- **0**: Identical vectors
- **1**: Orthogonal (perpendicular) vectors
- **2**: Opposite direction vectors

Similarity is computed as: `similarity = 1 - (distance / 2)`

## Future: Serverless GPU Provider

Currently uses OpenAI for simplicity. Future implementation will support:

- **Serverless GPU** (Modal, RunPod, etc.) for privacy
- Self-hosted embedding models (Hugging Face, sentence-transformers)
- Custom embedding dimensions
- Cost control and model customization

Turso is **provider-agnostic** - it only requires Float32Array vectors of consistent dimensionality.

## Performance Considerations

### Indexing

Vector indices use DiskANN algorithm with settings:
- `metric=cosine`: Cosine distance matching
- `compress_neighbors=float8`: 1 byte/dimension compression for index structure
- `max_neighbors=20`: Balance between accuracy and speed

### Batch Processing

Embeddings are generated in batches to minimize API calls:
- Space: 2 texts (title + description) per request
- Nodes: All node texts batched together (up to 2048 per OpenAI limit)

### Cost Estimation (OpenAI)

Using `text-embedding-3-small` at 768 dimensions:
- ~$0.00002 per 1K tokens
- Average cognitive space (~500 tokens) ≈ $0.00001
- 1000 spaces ≈ $0.01

## Troubleshooting

### "Vector search not available"

Ensure:
1. `DATABASE_TYPE=turso` (not postgres)
2. Database migrated: `npx tsx scripts/migrate-add-vectors.ts`
3. `ENABLE_VECTOR_SEARCH=true`

### "OPENAI_API_KEY is required"

Set your OpenAI API key in environment or `.env` file.

### No search results

- Lower the `threshold` parameter (try 0.3 or 0.4)
- Check that spaces have embeddings (re-insert or update them)
- Verify query is semantically related to content

### Embeddings not generated

Check console for errors. Common issues:
- OpenAI API rate limits
- Invalid API key
- Network connectivity

Embedding failures are non-fatal - spaces are created without embeddings.

## Examples

### Example 1: Finding Related Spaces

```typescript
// User asks: "What spaces are about decision-making?"
const spaces = await db.searchSpaces('decision making under uncertainty', 5);

// Returns spaces about:
// - Trust and verification
// - Risk assessment
// - Cognitive biases
```

### Example 2: Cross-Space Concept Search

```typescript
// Find all nodes mentioning "learning" across all spaces
const nodes = await db.searchAllNodes('learning and adaptation', 10, 0.6);

// Discovers related concepts like:
// - Memory encoding/retrieval
// - Skill acquisition
// - Pattern recognition
```

### Example 3: Exploring a Specific Space

```typescript
// Within a space about "Knowledge Graphs"
const nodes = await db.searchNodesInSpace(
  'knowledge-graph-space',
  'semantic relationships',
  5
);

// Finds nodes about:
// - Entity connections
// - Ontologies
// - Graph traversal
```

---

**Next Steps:**
1. Try the test script: `npx tsx test-vector-search.ts`
2. Experiment with different queries and thresholds
3. Integrate semantic search into your cognitive modeling UI
4. Consider migrating to serverless GPU for privacy
