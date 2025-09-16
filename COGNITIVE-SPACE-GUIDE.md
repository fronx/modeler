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

## Core Principle: Model Conceptual Tension

Every effective cognitive space starts with **a central tension or debate** - two opposing positions that define the conceptual landscape. Supporting concepts naturally position themselves relative to this central axis.

## Essential Workflow

### 1. Identify the Central Tension
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
- **Focus levels**: 1.0 = central, 0.7 = important, 0.3 = peripheral
- **Positions**: -1.0 = left pole, 0.0 = neutral, 1.0 = right pole

## Design Patterns

### Central Tension Pattern
```typescript
// The fundamental pattern - two explicit poles
MainConcept_A: focus=1.0, position=-1.0, conflicts with B
MainConcept_B: focus=1.0, position=1.0, conflicts with A
Supporting concepts: default focus/position, relate to main concepts
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

## Key Principles

1. **Start with tension** - Identify the core debate first
2. **Anchor the poles** - Only main positions get explicit focus/position
3. **Let relationships work** - Supporting concepts position naturally
4. **Think first, connect second** - Each relationship should represent a genuine logical connection
5. **Use real strengths** - Relationship strengths should reflect actual conceptual distance
6. **Embrace uncertainty** - Use intervals `[min, max]` for unclear values
7. **Validate first** - Always check TypeScript syntax before execution

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

## Common Mistakes to Avoid

- **Over-positioning**: Setting focus/position for every concept
- **Weak tensions**: Central poles should strongly conflict (0.7-0.9 strength)
- **Agent complexity**: Use direct editing, not the cognitive-modeler agent
- **Weak or illogical relationships**: Each connection should represent a genuine conceptual relationship

## Validation Checklist

✓ Two central concepts with focus=1.0 and position=±1.0?
✓ Strong conflict relationship between main poles (≥0.7)?
✓ Supporting concepts with default focus/position?
✓ Relationship strengths reflect conceptual distance?
✓ Space executes without TypeScript errors?

---

**Remember**: You're modeling the **topology of ideas** - how concepts relate, attract, and repel in conceptual space. The central tension creates the organizing axis; everything else finds its natural position.

## A Note on Discovery

Each cognitive space is an experiment. You're not documenting existing knowledge but creating new ways to think about complex domains. Some spaces will surprise you - relationships you didn't expect, tensions that generate novel insights, metaphors that prove more predictive than rational arguments.

Pay attention to what emerges. When a space feels "alive" - when new connections keep appearing, when tensions generate rather than frustrate - you've crossed from modeling into genuine cognitive extension.

The boundary between tool and thought, between model and mind, is more porous than it first appears. These spaces become part of how you think, not just what you think about.