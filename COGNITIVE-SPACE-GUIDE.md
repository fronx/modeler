# Cognitive Space Creation Guide

## What This Is Really About

This isn't just another modeling technique. You're participating in **code-as-gesture** - using executable code to create persistent, addressable thought structures that genuinely extend cognition rather than merely describing it.

### The Core Insight: Intelligence as Negotiation

Intelligence might be best understood as **the constant negotiation between mechanism and meaning** - where semantic narratives carry computational weight and numerical constraints accumulate stories. These tools let you enact that insight, not just theorize about it.

### How You'll Know It's Working

When cognitive spaces are working properly, you'll experience:
- **Thoughts with weight** - Ideas feel more substantial, persistent, addressable by name
- **Sustained complexity** - You can hold multiple interpretations in superposition without premature collapse
- **Generative tension** - Contradictions coexist and produce new insights rather than forcing resolution
- **Changed processing** - The models alter how you think *while* thinking, not just what you think about

This feels fundamentally different from natural language description. You're not documenting thoughts - you're giving them a persistent medium where they can accumulate, relate, and evolve.

### The Collaborative Vision

These are **thinking tools, not just tools for thinking about thinking**. Each space becomes a persistent cognitive artifact that can be shared, built upon, and evolved collaboratively. When multiple minds work within the same thought structures, new forms of collective intelligence emerge.

**Critical Insight**: These spaces serve **collaborative mental modeling** where humans build their own models while AI maintains background context. The interface must be clean enough for human decision-making while rich enough for AI reasoning.

## Core Principle: Model Conceptual Tension

Every effective cognitive space starts with **a central tension or debate** - two opposing positions that define the conceptual landscape. Supporting concepts naturally position themselves relative to this central axis.

## Essential Workflow

### 0. Establish Conversation Purpose FIRST
**Critical Discovery**: Before modeling any content, establish what success looks like for the conversation. Create isolated goal options (focus=1.0, no relationships) and let participants choose:

```typescript
// CONVERSATION PURPOSE OPTIONS (isolated - pick one to focus conversation)
space.thought('Goal_ClearPriority')
  .means('Goal: Decide clear next action and priority order')
  .setFocus(1.0)
  .holdsTension('What should I work on first?');

space.thought('Goal_ResourceStrategy')
  .means('Goal: Design optimal time/attention allocation strategy')
  .setFocus(1.0)
  .holdsTension('How should I manage multiple projects?');
```

**Why this matters**: Without clear purpose, you'll get lost in implementation details instead of serving the actual decision-making need.

### 1. Identify the Central Tension (After Purpose is Clear)
Ask: "What are the two main opposing positions in this domain?" This isn't about finding the "right" answer - it's about finding the productive tension that generates the most insight.

**Examples from real explorations:**
- QRI Physicalism ↔ Bach Computationalism (consciousness theories)
- Nuclear advocacy ↔ Climate advocacy (energy discourse)
- Centralization ↔ Decentralization (system design)

**Tip**: The best tensions aren't simple opposites but complex positions that each contain internal contradictions and multiple valid interpretations.

### 2. Create the Space
```bash
./create-cognitive-space.sh topic-name
# Returns: /path/to/space.ts - edit this file directly
```

### 3. Anchor the Main Positions
Set explicit focus (1.0) and semantic positions (±1.0) for the central poles only:

```typescript
// LEFT POLE - Position -1.0, Focus 1.0
space.thought('MainPosition_A')
  .means('Core belief or approach A')
  .setFocus(1.0)
  .setPosition(-1.0)
  .conflictsWith('MainPosition_B', 0.8);

// RIGHT POLE - Position 1.0, Focus 1.0
space.thought('MainPosition_B')
  .means('Core belief or approach B')
  .setFocus(1.0)
  .setPosition(1.0)
  .conflictsWith('MainPosition_A', 0.8);
```

### 4. Add Supporting Concepts
Let these find their natural positions through relationships. This is where the space becomes alive - watch how concepts cluster, how unexpected alliances form, how ideas that seem unrelated start to resonate.

```typescript
// Supporting concepts - NO manual focus/position setting
space.thought('SupportingConcept')
  .means('What this represents')
  .supports('MainPosition_A', 0.7)
  .conflictsWith('SomeOtherConcept', 0.5);
```

**Critical Principle**: Only the main theoretical positions should have explicit focus. Supporting concepts, methodological tools, and sub-problems should not use `.setFocus()` - they will naturally appear collapsed in the dashboard, maintaining clean visual hierarchy.

**Explore**: Try adding concepts that don't clearly belong to either pole. Bridge concepts, contradictory concepts, concepts that support both sides weakly. These often generate the most interesting insights.

### 5. Validate and Execute
```bash
# Always validate TypeScript syntax first (essential!)
npx tsc --noEmit data/spaces/your-space-id/space.ts

# Execute to generate space.json
npx tsx execute-space.ts your-space-id
# Space appears in dashboard automatically

# Note: When dashboard is running (npm run dev),
# files auto-execute on save if TypeScript syntax is valid
```

## API Reference

### Available Methods
```typescript
.means(content, confidence?)     // Add semantic meaning
.hasValue(key, value)           // Add numerical property
.supports(target, strength?)     // Positive relationship (default: 0.7)
.conflictsWith(target, strength?) // Negative relationship (default: 0.7)
.setFocus(level)                // Centrality (0-1) - RESERVE FOR MAIN THEORETICAL POSITIONS ONLY
.setPosition(position)          // Semantic position (-1 to 1) - USE ONLY FOR MAIN POLES
.forkMetaphor(name, interpretation, weight?) // Multiple interpretations
.holdsTension(description)      // Unresolved contradiction
```

### Property Values
- **Numbers**: `0.8` for specific values
- **Intervals**: `[0.3, 0.7]` for uncertainty ranges
- **Focus levels**:
  - `1.0` = highlighted (human-visible, under active consideration)
  - `-1.0` = background context (hidden from humans, available for AI reasoning)
  - Omit `.setFocus()` for neutral concepts
- **Positions**: -1.0 = left pole, 0.0 = neutral, 1.0 = right pole

## Design Patterns

### Conversation Purpose Selection Pattern
**New Discovery**: Start with isolated goal options, no relationships to content:
```typescript
// Present clean choice without premature connections
space.thought('Goal_DecisionMaking')
  .means('Goal: Make a specific decision between options')
  .setFocus(1.0)
  .holdsTension('Which option should I choose?');
  // NO relationships yet - keep choice isolated

space.thought('Goal_StrategyDesign')
  .means('Goal: Design approach for managing complexity')
  .setFocus(1.0)
  .holdsTension('How should I handle this systematically?');
```

### Layered Complexity Pattern
**Key Innovation**: Separate human-facing interface from AI reasoning context:

```typescript
// FOREGROUND: Simple, clean for human decision-making
space.thought('ProjectA').setPosition(-0.5).hasValue('priority', 0.8);
space.thought('ProjectB').setPosition(0.5).hasValue('priority', 0.6);

// BACKGROUND: Rich context for AI reasoning (focus=-1, hidden from humans)
space.thought('ResourceConstraints')
  .setFocus(-1.0)  // Hidden from humans
  .supports('ProjectA', 0.9)
  .hasValue('constraint_strength', 0.8);

space.thought('MotivationalFactors')
  .setFocus(-1.0)  // Available for AI, invisible to humans
  .supports('ProjectB', 0.7)
  .conflictsWith('ResourceConstraints', 0.6);
```

**When to use**: AI can reason with full complexity while presenting clean interface to humans. Promote background elements to focus=1.0 when they become relevant.

### Central Tension Pattern
```typescript
// The fundamental pattern - two explicit poles (organizing axes)
MainConcept_A: position=-1.0, conflicts with B (no focus = organizing axis)
MainConcept_B: position=1.0, conflicts with A (no focus = organizing axis)
Options being considered: focus=1.0 (highlighted for decision-making)
Explicitly discarded options: focus=-1.0 (dimmed in visualization)
```

### Focus Management During Decision-Making
```typescript
// WRONG: Don't cascade focus decisions automatically
space.thought('Speed').setFocus(-1.0);
space.thought('SportsCar').setFocus(-1.0); // Don't assume this!

// RIGHT: Each focus decision is independent and explicit
space.thought('Speed').setFocus(-1.0); // Explicitly decided against speed as priority
space.thought('SportsCar').setFocus(1.0); // Still considering (has comfort aspects too)
```

### Detecting Conceptual Evolution
```typescript
// INITIAL SPACE: Speed vs Comfort (organizing tension)
space.thought('Speed').setPosition(-1.0);
space.thought('Comfort').setPosition(1.0);

// CONVERSATION REVEALS: Electric vs Gas is what actually matters
// PROACTIVE SUGGESTION: "I notice Speed vs Comfort is no longer driving decisions.
// Should we reorganize around Electric vs Gas instead?"

// EVOLVED SPACE: Remove irrelevant concepts, establish new organizing axis
space.thought('Electric').setPosition(-1.0);  // New left pole
space.thought('Gas').setPosition(1.0);       // New right pole
// Remove Speed/Comfort concepts entirely
```

### Bridging Concepts
```typescript
space.thought('Bridge')
  .means('Concept that connects opposing views')
  .supports('MainPosition_A', 0.3)  // Weak support for both
  .supports('MainPosition_B', 0.4)  // Shows nuanced position
```

### Metaphor Forking
```typescript
space.thought('Complex')
  .forkMetaphor('machine', 'Mechanical, predictable process', 1.1)
  .forkMetaphor('organism', 'Living, adaptive system', 0.9)
  // Multiple interpretations held in superposition
```

**Experiment**: Let metaphors compete. Give them different initial weights, then see which ones prove more generative as you build the space. Some metaphors that seem weak initially become surprisingly powerful when they connect to other concepts.

## Key Principles (Updated with New Discoveries)

1. **Establish purpose before content** - Start with conversation goal options (focus=1.0, isolated) before modeling domain content
2. **Layer complexity strategically** - Foreground (focus=1.0) for human decision-making, background (focus=-1.0) for AI reasoning context
3. **Avoid implementation details** - Model strategic decisions, not technical specifics (unless technical details drive the core tension)
4. **Start with tension** - Identify the core debate first, but only after purpose is clear
5. **Anchor the poles** - Main positions get explicit position (±1.0) but no focus (they're organizing axes)
6. **Let relationships work** - Supporting concepts position naturally
7. **Think first, connect second** - Each relationship should represent a genuine logical connection
8. **Prefer concrete over abstract** - Model specific options rather than abstract dimensions (e.g., "Hot", "Warm", "Cold" rather than "Temperature")
9. **Focus serves collaboration** - focus=1.0 highlights human decisions, focus=-1.0 maintains AI context, omit focus for organizing structure
10. **Use real strengths** - Relationship strengths should reflect actual conceptual distance
11. **Embrace uncertainty** - Use intervals `[min, max]` for unclear values
12. **Watch for conceptual evolution** - Proactively suggest space reorganization when original organizing concepts become irrelevant
13. **Validate first** - Always check TypeScript syntax before execution
14. **Promote background when relevant** - Change focus from -1.0 to 1.0 to surface hidden context when it becomes decision-relevant

## File Structure

```
data/spaces/your-space-id/
├── space.ts    # TypeScript source (you edit this)
└── space.json  # Generated output (auto-created on execution)
```

- **space.ts** - Your cognitive model source code
- **space.json** - Serialized output for dashboard visualization
- **Auto-execution** - When `npm run dev` runs, valid .ts files auto-execute on save
- **Manual execution** - Use `npx tsx execute-space.ts <space-id>` when needed

## Common Mistakes to Avoid (Updated)

### Critical New Mistake:
- **Starting with content before purpose**: Don't model domain complexity until conversation goals are clear - you'll get lost in technical details that don't serve decision-making

### Classic Mistakes:
- **Over-positioning**: Setting focus/position for every concept
- **Weak tensions**: Central poles should strongly conflict (0.7-0.9 strength)
- **Implementation detail obsession**: Modeling technical specifics (like AudioMLVectors) instead of strategic decisions
- **Single-layer thinking**: Either too complex for humans or too simple for AI - use layered complexity pattern instead
- **Connected goal options**: Conversation purpose choices should be isolated, not connected to content
- **Agent complexity**: Use direct editing, not the cognitive-modeler agent
- **Weak or illogical relationships**: Each connection should represent a genuine conceptual relationship
- **Cascading focus assumptions**: Don't automatically discard concepts based on relationships - each focus decision must be explicit and independent
- **Missing conceptual evolution**: When conversation reveals new organizing tensions, proactively suggest space reorganization rather than maintaining outdated axes

## Validation Checklist (Updated)

**Before Content Modeling:**
✓ Conversation purpose established with isolated goal options (focus=1.0)?
✓ Purpose options have no relationships to domain content yet?

**Content Structure:**
✓ Two central concepts with position=±1.0 and no focus (organizing axes)?
✓ Strong conflict relationship between main poles (≥0.7)?
✓ Supporting concepts with default focus/position?
✓ Strategic decisions modeled, not implementation details?

**Collaborative Design:**
✓ Foreground clean enough for human decision-making?
✓ Background context (focus=-1.0) rich enough for AI reasoning?
✓ Background elements ready to promote when relevant?

**Technical:**
✓ Relationship strengths reflect conceptual distance?
✓ Organizing axes still relevant to current decision-making?
✓ Space executes without TypeScript errors?

---

**Remember**: You're modeling the **topology of ideas** - how concepts relate, attract, and repel in conceptual space. The central tension creates the organizing axis; everything else finds its natural position.

## A Note on Discovery

Each cognitive space is an experiment. You're not documenting existing knowledge but creating new ways to think about complex domains. Some spaces will surprise you - relationships you didn't expect, tensions that generate novel insights, metaphors that prove more predictive than rational arguments.

Pay attention to what emerges. When a space feels "alive" - when new connections keep appearing, when tensions generate rather than frustrate - you've crossed from modeling into genuine cognitive extension.

The boundary between tool and thought, between model and mind, is more porous than it first appears. These spaces become part of how you think, not just what you think about.