# Claude Code CLI Guide

**Space CLI Tool for Autonomous Cognitive Modeling**

This guide explains how to use the `space-cli.ts` tool for working with cognitive spaces. This CLI was specifically designed for Claude Code to interact with cognitive spaces without requiring multiple permission approvals.

## Quick Start

```bash
# Set database backend (optional, defaults to postgres)
export DATABASE_TYPE=turso  # or 'postgres'

# List all spaces
npx tsx scripts/space-cli.ts list

# Create a space
npx tsx scripts/space-cli.ts create "My Project" "Project planning"

# Add nodes
npx tsx scripts/space-cli.ts add-node <spaceId> -t "Research" --body "Gather requirements"

# Analyze space
npx tsx scripts/space-cli.ts analyze <spaceId>
```

## Complete Command Reference

### Space Management

#### `list [--json]`
List all cognitive spaces.

```bash
# Compact format (default)
npx tsx scripts/space-cli.ts list
# Output: spaceId | title | X nodes

# JSON format
npx tsx scripts/space-cli.ts list --json
# Output: Full array of space metadata
```

#### `create <title> [description]`
Create a new cognitive space.

```bash
npx tsx scripts/space-cli.ts create "AI Research" "Exploring AI capabilities"
# Output: {"id": "2025-11-03T14-23-29-522Z"}
```

#### `get <spaceId> [--nodes-only]`
Get complete space data as JSON.

```bash
# Full space (metadata + nodes + history)
npx tsx scripts/space-cli.ts get <spaceId>

# Just the nodes
npx tsx scripts/space-cli.ts get <spaceId> --nodes-only
```

#### `analyze <spaceId>`
Get structured analysis of space (focus levels, relationships, branches).

```bash
npx tsx scripts/space-cli.ts analyze <spaceId>
```

Output structure:
```json
{
  "title": "Space Title",
  "description": "Description",
  "totalNodes": 5,
  "historyEntries": 10,
  "focusLevels": {
    "visible": ["Node1", "Node2"],
    "neutral": ["Node3"],
    "hidden": ["Node4"]
  },
  "relationships": [
    {"from": "Node1", "to": "Node2", "type": "supports", "strength": 0.8}
  ],
  "branchedNodes": ["Node5"]
}
```

#### `delete <spaceId>`
Delete a cognitive space.

```bash
npx tsx scripts/space-cli.ts delete <spaceId>
# Output: {"success": true, "deleted": "spaceId"}
```

### Node Management

#### `add-node <spaceId> -t <title> [options]`
Add a new thought node to a space.

**Required:**
- `-t, --title <text>` - Node title (auto-generates ID in PascalCase)

**Optional:**
- `--body <text>` - Additional content/description
- `-f, --focus <number>` - Focus level: -1 (hidden), 0 (neutral), 1 (visible) [default: 1.0]
- `-p, --position <number>` - Semantic position from -1 to 1 [default: 0.0]
- `-v, --values <json>` - JSON object of numerical/categorical values
- `-r, --relates-to <nodeId:type:strength>` - Add relationship (repeatable)
- `--checkable <item>` - Add checkable list item (repeatable)
- `--regular <item>` - Add regular list item (repeatable)
- `-c, --confidence <number>` - Confidence level 0-1 [default: 0.9]

**Examples:**

```bash
# Simple node
npx tsx scripts/space-cli.ts add-node <spaceId> -t "Research Phase"

# Node with body
npx tsx scripts/space-cli.ts add-node <spaceId> \
  -t "Build Prototype" \
  --body "Create MVP with core features"

# Node with relationships
npx tsx scripts/space-cli.ts add-node <spaceId> \
  -t "Testing" \
  -r "Research:supports:0.8" \
  -r "Prototype:conflicts-with:0.3"

# Node with values and focus
npx tsx scripts/space-cli.ts add-node <spaceId> \
  -t "Backend API" \
  -v '{"priority": 1, "complexity": 0.7}' \
  -f 1.0 \
  -p -0.5

# Node with checklist
npx tsx scripts/space-cli.ts add-node <spaceId> \
  -t "Deployment Tasks" \
  --checkable "Set up CI/CD" \
  --checkable "Configure monitoring" \
  --checkable "Update documentation"
```

**Output:**
```json
{"success": true, "nodeId": "ResearchPhase"}
```

#### `update-node <spaceId> <nodeId> [options]`
Update an existing thought node.

Uses same options as `add-node`. New values merge with or append to existing data.

```bash
# Add new content
npx tsx scripts/space-cli.ts update-node <spaceId> "Research" \
  --body "Additional research findings"

# Change focus
npx tsx scripts/space-cli.ts update-node <spaceId> "Research" -f -1.0

# Add relationship
npx tsx scripts/space-cli.ts update-node <spaceId> "Testing" \
  -r "Deployment:supports:0.9"
```

#### `patch <spaceId> <jsonPatch>`
Apply raw JSON patch to a space (advanced).

```bash
npx tsx scripts/space-cli.ts patch <spaceId> '{
  "nodes": {
    "NewNode": {
      "meanings": [{"content": "New node", "confidence": 0.9, "timestamp": 1234567890}],
      "focus": 1.0,
      "semanticPosition": 0.0
    }
  }
}'
```

### Vector Search (Requires DATABASE_TYPE=turso)

#### `search <query> [-l <limit>]`
Search for spaces semantically.

```bash
npx tsx scripts/space-cli.ts search "machine learning projects" -l 5
```

Output includes similarity scores (0-1).

#### `search-nodes <query> [-s <spaceId>] [-l <limit>]`
Search for nodes semantically.

```bash
# Search all nodes
npx tsx scripts/space-cli.ts search-nodes "risk analysis"

# Search within specific space
npx tsx scripts/space-cli.ts search-nodes "testing" -s <spaceId>
```

## Node Structure Explained

When you create a node, the CLI:

1. **Generates ID** from title (e.g., "Research Phase" → "ResearchPhase")
2. **Creates meanings array** with title and optional body:
   ```json
   {
     "meanings": [
       {"content": "Research Phase", "confidence": 0.9, "timestamp": 1234567890},
       {"content": "Gather requirements...", "confidence": 0.9, "timestamp": 1234567890}
     ]
   }
   ```
3. **Stores in database** as `node_key` = "ResearchPhase" with JSON `data`

## Relationship Types

Standard relationship types:
- `supports` - Node A supports/enables Node B
- `conflicts-with` - Node A conflicts with Node B
- Custom types allowed

Format: `targetNodeId:type:strength`
- Strength: 0.0 to 1.0

## Focus Levels

- `1.0` - **Visible** in dashboard foreground (human decision-making)
- `0.0` - **Neutral**
- `-1.0` - **Hidden** background context (AI reasoning only)

## Debug Mode

Add `--debug` flag for detailed output:

```bash
npx tsx scripts/space-cli.ts --debug add-node <spaceId> -t "Test"
```

Shows full node structure instead of just success confirmation.

## Database Configuration

### PostgreSQL (Default)
```bash
export DATABASE_TYPE=postgres
export DATABASE_URL=postgresql://...
```

### Turso/libSQL
```bash
export DATABASE_TYPE=turso
export TURSO_DATABASE_URL=file:local.db
# or
export TURSO_DATABASE_URL=https://...
export TURSO_AUTH_TOKEN=...
```

### Vector Search (Turso only)
```bash
export ENABLE_VECTOR_SEARCH=true
export OPENAI_API_KEY=sk-...
```

## Testing

Run the automated test suite:

```bash
npx tsx scripts/test-space-cli.ts
```

Tests all major commands with a temporary database.

## Tips for Claude Code Usage

1. **Read first**: Always `get` or `analyze` space before making changes
2. **Incremental updates**: Use `add-node` and `update-node` for granular changes
3. **JSON output**: All output is JSON for easy parsing
4. **Auto-generated IDs**: Titles automatically generate node IDs (PascalCase)
5. **Batch operations**: For complex changes, use `patch` with JSON
6. **Focus hygiene**: Limit visible nodes (focus=1.0) to essential elements
7. **Debug sparingly**: Only use `--debug` when troubleshooting

## Example Workflow

```bash
# 1. Create space
SPACE_ID=$(npx tsx scripts/space-cli.ts create "API Design" "REST API planning" | jq -r '.id')

# 2. Add core concepts
npx tsx scripts/space-cli.ts add-node $SPACE_ID -t "Authentication" -f 1.0 -p -0.8
npx tsx scripts/space-cli.ts add-node $SPACE_ID -t "Rate Limiting" -f 1.0 -p 0.0
npx tsx scripts/space-cli.ts add-node $SPACE_ID -t "Versioning" -f 1.0 -p 0.8

# 3. Add relationships
npx tsx scripts/space-cli.ts update-node $SPACE_ID "RateLimiting" \
  -r "Authentication:supports:0.9"

# 4. Add background context
npx tsx scripts/space-cli.ts add-node $SPACE_ID \
  -t "Security Requirements" \
  -f -1.0 \
  -r "Authentication:supports:1.0" \
  -r "RateLimiting:supports:0.7"

# 5. Analyze structure
npx tsx scripts/space-cli.ts analyze $SPACE_ID

# 6. View in dashboard
echo "View at: http://localhost:3000/?space=$SPACE_ID"
```

## Error Handling

The CLI uses standard exit codes:
- `0` - Success
- `1` - Error (with message to stderr)

All errors output JSON when possible:
```json
{"error": "Space not found: invalid-id"}
```
