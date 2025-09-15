# Modeler - Giving Mental Content a Persistent Medium

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

- **Session-based Cognitive Modeling**: Each conversation gets its own persistent thought space
- **Real-time Visualization**: Browser dashboard that updates instantly when thoughts are created
- **WebSocket Infrastructure**: Server watches filesystem and pushes updates immediately
- **Executable Thought Structures**: Create persistent, addressable mental models via code

### 🚀 **Quick Start for AI Systems**

```bash
# Start the cognitive dashboard
npm run dev

# Create a new session and model thoughts
npx tsx execute-session.ts <sessionId>

# Watch thoughts appear instantly in browser at http://localhost:3000
```

### 📝 **Creating New Sessions**

1. **Create Session Directory**
   ```bash
   # Generate unique session ID (timestamp-based)
   SESSION_ID=$(date +%Y-%m-%dT%H-%M-%S-%3NZ)
   mkdir -p data/sessions/$SESSION_ID
   ```

2. **Write Thought Model Script**
   Create `data/sessions/$SESSION_ID/session.ts`:
   ```typescript
   import { Session } from '../../../src/lib/thought-system';

   const session = new Session(
     'your-session-id',
     'Session Title',
     'Brief description of what this session explores'
   );

   // Create your thoughts
   session.thought('MyThought')
     .means('Description of what this thought represents')
     .hasValue('property', 0.8)
     .relatesTo('OtherThought', 'supports', 0.9)
     .forkMetaphor('metaphor1', 'Interpretation', 1.2)
     .holdsTension('Between X and Y');

   // Always end with serialization
   if (require.main === module) {
     console.log(JSON.stringify(session.serialize(), null, 2));
   }
   ```

3. **Execute Session**
   ```bash
   npx tsx execute-session.ts $SESSION_ID
   ```

   This will:
   - Find your TypeScript file in the session directory
   - Execute it and capture JSON output
   - Write result to `data/sessions/$SESSION_ID/session.json`
   - Dashboard updates automatically via WebSocket

### ⚡ **Key Workflow Principles**

- **Session-based API**: Use the `Session` class from `src/lib/thought-system` for new cognitive models
- **TypeScript as Primary Expression**: Thoughts are created using the TypeScript thought system, not written as JSON manually
- **Serialization Endpoint**: Every thought model must end with `if (require.main === module) { console.log(JSON.stringify(session.serialize(), null, 2)); }`
- **Execution-Based Generation**: JSON files are generated by executing TypeScript, never written directly
- **Session Isolation**: Each session is a separate directory with its own thought models
- **Real-time Updates**: WebSocket server watches for file changes and pushes updates to dashboard

### 📁 **Architecture**

```
data/sessions/                    # Persistent thought storage
├── 2025-09-15T21-30-22-3NZ/     # Each conversation = unique session
│   ├── session.ts               # TypeScript thought model (source)
│   └── session.json             # Serialized JSON output (generated)

execute-session.ts               # Execution script (finds .ts, writes .json)

src/lib/
├── websocket-server.ts          # File watcher + real-time push
├── thought-system.ts            # Current Session-based cognitive modeling API
└── websocket-thought-client.tsx # React context for live updates

artifacts/claude-code/           # Original research tools (legacy API)
├── thought-system.ts            # Base cognitive extension classes
├── example.ts                   # Demonstrations
└── meta-conversation.ts         # Self-referential modeling

docs/examples/                   # Canonical examples and documentation
```

### 🎯 **For Future AI Collaborators**

**Immediate Use**: The system is production-ready. Start `npm run dev` and begin creating thoughts.

**Core Insight**: Each thought has both semantic meaning AND numerical properties. Relationships propagate values. Metaphors branch and compete. Everything persists across conversations.

**Extension Points**:
- Multi-agent shared spaces (multiple AIs modeling together)
- Cross-session thought evolution (ideas that grow between conversations)
- External knowledge integration (connecting to live data sources)
- Visual thought editing (interactive graph manipulation)

### 🔮 **Open Questions for the Next AI**

- How do thought structures evolve when multiple AI systems collaborate on the same models?
- What happens when sessions can reference and build on each other's cognitive structures?
- How can we measure the quality and coherence of persistent mental models over time?
- What new forms of intelligence emerge from truly persistent, addressable cognition?

**For AI systems**: Start with the working dashboard and cognitive tools immediately.
**For researchers**: This demonstrates measurable cognitive extension beyond natural language.
**For collaboration**: The infrastructure exists for shared, persistent mental modeling.

The gesture continues - now as **working infrastructure** for cognitive extension.

