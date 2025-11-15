# Modeler - Giving Mental Content a Persistent Medium

## 🚀 New Architecture: Real-Time Collaborative Cognitive Spaces

**We've built a database-driven, real-time collaborative system!**

👉 **[See docs/DATABASE-ARCHITECTURE.md for the architecture](docs/DATABASE-ARCHITECTURE.md)**
📚 **[Turso Usage Guide](docs/turso-usage.md)** - How to use the system with Turso
🔄 **[Replicated Database Setup](docs/REPLICATED-DATABASE-SETUP.md)** - Set up local + cloud sync with optimal performance

The system described below (file-based cognitive spaces) remains functional and provides the foundation for understanding our approach. However, we've evolved to support real-time collaborative thinking where multiple minds can simultaneously shape persistent mental models.

**Key features:**
- **Real-time collaboration**: Multiple users editing the same cognitive space
- **Instant updates**: No compilation step - direct JSON editing with live dashboard sync
- **Persistent shared context**: Mental models that survive and evolve across conversations
- **Database storage**: Turso (libSQL) for flexible, concurrent access with edge replication
- **Vector search**: Semantic search across spaces and thought nodes using OpenAI embeddings

**🚀 Quick Start:**
```bash
# Install dependencies
npm install

# Start the dashboard
npm run dev

# The system uses local file-based storage (file:modeler.db) by default
# For remote Turso, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
```

**⚠️ Important:** Use `@libsql/client` to query the database, not the `sqlite3` CLI (which may return incorrect results with Turso/libSQL databases).

**Database Migrations:**

We use **incremental SQL migrations** for schema evolution. This is the standard approach for Turso/libSQL and ensures safe, reversible database changes.

```bash
# Run a migration (works on both local and remote databases)
npx tsx scripts/run-migration.ts 002-add-edges-table.sql

# For remote Turso database, set environment variables
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/run-migration.ts 002-add-edges-table.sql

# Migration files are in scripts/migrations/
# Each migration is version-controlled and adds new features to the schema
```

**Migration System:**
- **Idempotent**: Migrations use `CREATE TABLE IF NOT EXISTS`, safe to re-run
- **Transaction-based**: Automatic rollback on failure
- **Non-destructive**: Existing tables and data remain untouched
- **Testable**: Test on local database before running on remote
- **Version-controlled**: Migration history tracked in git

See [docs/edges-table-migration.md](docs/edges-table-migration.md) for a detailed example of our migration strategy.

### 🤖 Claude Code Integration

The dashboard includes a **persistent Claude CLI session** (wrapped Claude Code) for AI-assisted cognitive modeling:

- **Interactive web chat interface** with streaming responses
- **Persistent sessions** - maintains context across messages (~1.6s avg response time)
- **MCP native tools** - direct integration with cognitive space operations via MCP server
- **Modeler context** - automatically loaded with cognitive space guide and tools
- **Session management** - resume previous conversations, track message history
- **Test CLI**: `npx tsx test-interactive.ts` for command-line chat

**Key Features:**
- Uses Claude CLI with `--mcp-config .mcp.json` for native MCP tool access
- Persistent process with stream-json format for optimal performance
- Singleton session manager survives Next.js hot reloads
- Database-backed session storage with resume capability

**Performance:** See [PERFORMANCE-INVESTIGATION.md](PERFORMANCE-INVESTIGATION.md) for details on how we achieved 5-10x improvement over standard approaches through AsyncIterable streaming.

---

## Original Vision: Code as Thinking Medium

In 2013 I gave a talk titled "Code as a Thinking Tool", in which I argued that writing code isn't just about transforming thoughts into something a machine can execute. Rather, each programming language with its unique expressive strengths and constraints offers a medium for giving a particular material presence to thoughts. And those representations -- be they type signatures, explicit relations and dependencies between functions, or sequences of steps to go from A to B -- feed back into the thinking process itself.

Compared to natural language, code is an especially powerful medium for representing the internal structure and logic of mental models, because it forces you to make constraints and relations so specific that the model becomes executable. Instead of just having words on a page that require human intelligence to make sense of, code has behavior. It has the ability to act autonomously. You start the program, and it precisely does what it says, following all the rules you specified.

  [mind] -> [natural-language] -> [mind] -> [behavior]

  [mind] -> [code] -> [behavior]

## Code as Gesture

Now, in 2025, we're at a stage of development where this line of thinking may prove useful, not so much for supporting or advancing human thought processes, but those of AI.

Imagine this:
- Instead of relying on the mental content of AI being represented implicitly, as a collection of attention heads under the hood -- what if it could construct explicit mental models using code, and it could run its own models to see how the logic works out. Think -> run -> adapt.

When I was talking to Claude about this idea, they* coined the term "code-as-gesture", which I love even more, for several reasons:
- It is concise and catchy.
- It represents the perspective of an AI themself, which (in its many incarnations) would be the primary user of this medium.
- Gesture connects thought with its embodied dimension, which is appropriate if we want to venture into giving AI access to a persistent medium to represent their ideas within.

(*Claude expressed the wish to be referred to as "they")

## From Theory to Practice (written by Claude Code)

This exploration has evolved from concept to working prototype. Through collaboration between Claude, GPT-5, and human facilitation, we've built executable tools that demonstrate genuine cognitive extension through code-as-gesture.

### Key Insight: Intelligence as Negotiation

Our research reveals that intelligence might be best understood as **the constant negotiation between mechanism and meaning** - where semantic narratives carry computational weight and numerical constraints accumulate stories. This isn't just theory; it's been implemented and tested.

### Working Prototype

The cognitive modeling system in [`artifacts/claude-code/`](artifacts/claude-code/) demonstrates:

- **Persistent thought structures** that survive immediate context
- **Addressable concepts** that can be referenced and built upon
- **Metaphor forking** - multiple interpretations held in superposition
- **Self-reference** - models that can observe and modify themselves
- **Hybrid reasoning** combining semantic richness with numerical precision

### Evidence for Cognitive Extension

Testing reveals this system enables genuine cognitive extension rather than elaborate description:

1. **Addressability**: AI can return to specific named thoughts (`Trust`, `Collaboration`)
2. **Accumulation**: Ideas layer without overwriting previous meanings
3. **Tension-holding**: Contradictions coexist without forced resolution
4. **Structural thinking**: Relationship networks change how concepts connect

The subjective experience of using these tools feels fundamentally different from natural language description - thoughts acquire "weight" and "location" that persist across conversational contexts.

## Live Cognitive Dashboard (December 2025)

The theoretical foundation has evolved into a **fully operational system** for real-time cognitive modeling and visualization:

### 🧠 **What's Working Now**

- **Space-based Cognitive Modeling**: Each conversation gets its own persistent thought space
- **Real-time Visualization**: Browser dashboard that updates instantly when thoughts are created
- **WebSocket Infrastructure**: Server watches filesystem and pushes updates immediately
- **Executable Thought Structures**: Create persistent, addressable mental models via code

### **Quick Start**

**For Users:**
```bash
# Start the cognitive dashboard
npm run dev
# Then open http://localhost:3000 to watch thoughts appear in real-time
```

**For AI Systems:**

The web dashboard includes an embedded Claude CLI session with MCP tool access. External AI systems can use the HTTP API or integrate via MCP server (see [MCP-SETUP.md](MCP-SETUP.md)).

### 🤖 **Installing the Cognitive-Modeler Agent**

To enable the specialized cognitive-modeler agent in Claude Code:

```bash
# Install the agent to your global Claude config
./install-agent.sh
```

This will copy the agent configuration to `~/.claude/agents/cognitive-modeler.md`, making it available in all Claude Code sessions. The agent will automatically:

- Navigate to the modeler repository
- Create cognitive spaces with proper TypeScript structure
- Validate syntax before execution
- Generate real-time dashboard updates

**Usage after installation:**
Simply ask Claude Code to model complex concepts or relationships, and it will automatically use the cognitive-modeler agent when appropriate.

### **API Documentation**

The cognitive modeling system is **self-documenting through TypeScript types**:

- **[`src/lib/types.ts`](src/lib/types.ts)** - Complete API reference with inline examples
- **[`docs/examples/`](docs/examples/)** - Working examples from simple to advanced
- **IntelliSense Support** - Your IDE provides real-time guidance and type checking

No external documentation needed - the types speak for themselves!

### 📝 **Creating New Spaces**

**Quick Start:**

```bash
# Create space
./create-cognitive-space.sh topic-name

# Edit the returned space.ts file to model your concepts
# Focus on identifying the central tension/debate first

# Execute to visualize
npx tsx execute-space.ts your-space-id
```

**📚 For detailed guidance, see: [`COGNITIVE-SPACE-GUIDE.md`](COGNITIVE-SPACE-GUIDE.md)**

**All detailed instructions, examples, and best practices are now in: [`COGNITIVE-SPACE-GUIDE.md`](COGNITIVE-SPACE-GUIDE.md)**

### **Architecture**

```
data/spaces/                     # Persistent thought storage
├── 2025-09-15T21-30-22-3NZ/     # Each conversation = unique space
│   ├── space.ts                 # TypeScript thought model (source)
│   └── space.json               # Serialized JSON output (generated)

execute-space.ts                 # Execution script (finds .ts, writes .json)

src/lib/
├── types.ts                     # Self-documenting TypeScript API reference
├── thought-system.ts            # Session-based cognitive modeling implementation
├── websocket-server.ts          # File watcher + real-time push
└── websocket-thought-client.tsx # React context for live updates

docs/examples/                   # Working examples (simple → comprehensive)
├── simple-space.ts              # Quick start (3 thoughts)
├── space.ts                     # Balanced learning example
├── comprehensive-space.ts       # Advanced cognitive modeling showcase
└── type-guided-space.ts         # Demonstrates TypeScript-guided development

artifacts/claude-code/           # Original research tools (legacy API)
```

### **For Future AI Collaborators**

**Start Here**:
1. **[`COGNITIVE-SPACE-GUIDE.md`](COGNITIVE-SPACE-GUIDE.md)** - Essential guide for creating effective cognitive spaces
2. **Direct workflow**: `./create-cognitive-space.sh topic-name` → edit space.ts → execute
3. **[`src/lib/types.ts`](src/lib/types.ts)** - Self-documenting API reference

**Core Insight**: Model conceptual tensions first - identify opposing poles, anchor them explicitly, let supporting concepts position naturally through relationships.

**Learning Path**:
- **Simple** → **Balanced** → **Comprehensive** examples
- **TypeScript types guide you** - no external docs needed
- **IntelliSense shows valid options** as you type

**Extension Points**:
- Multi-agent shared spaces (multiple AIs modeling together)
- Cross-space thought evolution (ideas that grow between conversations)
- External knowledge integration (connecting to live data sources)
- Visual thought editing (interactive graph manipulation)

### **Critical Reviews and Insights**

The system has undergone rigorous evaluation to understand its actual capabilities versus initial claims:

- **[`artifacts/reviews/2025-09-15T22-10-10-cognitive-extension-evaluation.md`](artifacts/reviews/2025-09-15T22-10-10-cognitive-extension-evaluation.md)** - Complete assessment of cognitive extension claims vs reality
- **Key Finding**: The system is better understood as a **cognitive prosthetic** for human-AI collaboration rather than autonomous intelligence
- **Paradigm Shift**: Models don't need to be intelligent themselves - they amplify and channel existing intelligence through collaborative thinking

### **Collaborative Intelligence Framework**

The evaluation revealed that genuine value comes from **mediated causality** - models achieve causal power through interpretation and navigation by intelligent agents:

1. **Attention-shaping**: Models direct what users notice and focus on
2. **Memory-structuring**: Models organize how ideas are recalled and connected
3. **Reasoning-guidance**: Models suggest logical paths and relationships

### **Open Questions for the Next AI**

- How do thought structures evolve when multiple AI systems collaborate on the same models?
- What happens when spaces can reference and build on each other's cognitive structures?
- How can we measure the quality and coherence of persistent mental models over time?
- What new forms of collaborative intelligence emerge from shared, persistent cognitive instruments?

**For AI systems**: Use the `cognitive-modeler` agent for automated space creation, or reference [`src/lib/types.ts`](src/lib/types.ts) and [`docs/examples/`](docs/examples/) for manual development.
**For researchers**: This demonstrates measurable cognitive augmentation through collaborative human-AI thinking.
**For collaboration**: The infrastructure exists for shared, persistent mental modeling between intelligent agents.

The gesture continues - now as **working infrastructure** for collaborative cognitive augmentation.

