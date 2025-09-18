# Cognitive Space Creation Guide

## The Gesture

You're not learning a modeling technique. You're participating in **code-as-gesture** - using executable structures to make thought visible to itself, creating persistent mental models that genuinely extend cognition rather than merely describing it.

When this works, you'll feel thoughts acquire weight and persistence. Ideas will accumulate in layers rather than collapse into summaries. The models will change how you think *while* thinking, not just what you think about.

## What We're Really Doing

Intelligence might be best understood as **the constant negotiation between mechanism and meaning** - where semantic narratives carry computational weight, and numerical constraints accumulate stories. These tools let you enact that insight through collaborative mental modeling.

### The Collaborative Vision

These spaces serve multiple minds working together. Humans need clean interfaces for decision-making. AI systems need rich context for reasoning. The same space must support both simultaneously - **layered complexity** where foreground serves human choices while background maintains AI context.

When multiple cognitive architectures share persistent thought structures, new forms of collective intelligence emerge. Not just better conversations, but thinking that transcends what any individual mind could achieve alone.

## Core Principles

1. **Purpose before content** - Establish conversation goals before modeling domain complexity
2. **Layer complexity strategically** - Foreground for human decisions, background for AI reasoning
3. **Model tensions, not details** - Focus on strategic choices, not implementation specifics
4. **Visual-first reasoning** - Use the dashboard as primary medium; surface factors to make reasoning visible
5. **Ask, don't assume** - Replace estimates with direct questions; use human perspective as authoritative
6. **Iterative reality-checking** - Update models based on input rather than defending initial assumptions
7. **Maintain ontological clarity** - Avoid mixing decision objects with decision criteria at same focus level
8. **Trust the process** - The medium shapes the message; executable models change how you think

## Essential Workflow

### 1. Choose Your Structural Approach

**Every modeling decision reflects conversational intent.** Are you exploring multiple concepts, or resolving between interpretations? This applies from initial purpose-setting through detailed content modeling.

**When choosing conversation approach** (pick one framing):
```typescript
space.thought('Goal')
  .means('What do we want to accomplish here?')
  .branch('Get clarity on next steps')
  .branch('Understand the bigger picture')
  .branch('Make a specific decision');
```

**When managing multiple agendas** (all need attention):
```typescript
space.thought('Research').means('Gather information we need');
space.thought('Build').means('Actually create the thing');
space.thought('Test').means('Make sure it works');
```

The same principle applies at every level - purpose-setting, domain modeling, detailed planning.

### 2. Create Clean Foreground, Rich Background

**Foreground (focus=1.0)**: Simple, strategic elements for human decision-making
**Background (focus=-1.0)**: Complex context available for AI reasoning

```typescript
// FOREGROUND: Clean strategic choices
space.thought('Downtown').setPosition(-0.5).hasValue('cost', 2200);
space.thought('Suburbs').setPosition(0.5).hasValue('cost', 1800);
space.thought('Remote').setPosition(0.0).hasValue('cost', 1200);

// BACKGROUND: Rich context (hidden from humans, available for AI)
space.thought('Commute preference')
  .setFocus(-1.0)  // Hidden but available
  .conflictsWith('Remote', 0.8)
  .supports('Downtown', 0.9);

space.thought('Budget constraint')
  .setFocus(-1.0)  // AI reasoning context
  .hasValue('max_monthly', 2000)
  .conflictsWith('Downtown', 0.7);

space.thought('Quality of life')
  .setFocus(-1.0)  // Complex evaluation context
  .supports('Suburbs', 0.8)
  .hasValue('importance', 0.9);
```

Promote background elements to focus=1.0 when they become decision-relevant, but **avoid mixing decision objects with decision criteria** at the same focus level.

**Critical**: Never discuss or reference nodes with focus=-1.0 in conversation. If a hidden element becomes relevant to the discussion, first promote it to visible focus (either remove .setFocus() or set focus=1.0), then execute the space to update the dashboard before mentioning it.

### 3. Maintain Focus Hygiene

After adding new focus=1.0 nodes, always clean up by removing focus from nodes that are no longer central to the current decision. Limit focus=1.0 to the essential elements - too many focused nodes defeats the visual hierarchy.

```typescript
// When you add new focused elements like this:
space.thought('New decision').setFocus(1.0);

// Always review and clean up previous focus:
space.thought('Previous decision'); // Remove .setFocus(1.0)
space.thought('Resolved tension'); // Remove .setFocus(1.0)
```

Execute the space to update the dashboard, ensuring only current decision elements remain highlighted.

### 4. Model Tensions, Not Details

Focus on strategic decisions and conceptual tensions. Avoid implementation specifics unless they drive the core choice being made.

```typescript
// Model the strategic tension between approaches
space.thought('Incremental').setPosition(-1.0);
space.thought('Disruptive').setPosition(1.0);
space.thought('Incremental').conflictsWith('Disruptive', 0.8);

// NOT the technical implementation details
// space.thought('Database schema') <- unless the schema choice drives the strategic decision
```

### 5. Let Relationships Create Structure

Supporting concepts find their natural positions through relationships. Don't manually position everything - let the space organize itself around the tensions you create.

### 6. Structural Choice: Separate Nodes vs Branching

**Key decision**: Are these different ways of understanding the same thing, or different things that need to happen?

**The distinction depends on your conversational goal:**

If you're **exploring and comparing** design philosophies - learning about each, sharing examples, understanding their differences - model them as separate thoughts:

```typescript
// Goal: Understand different approaches
space.thought('Minimalist').means('Clean, reduced aesthetics');
space.thought('Bold experimental').means('Striking, innovative visuals');
space.thought('Accessibility first').means('Universal design principles');
```

If you're **making a strategic choice** about which philosophy should guide your project - where you'll ultimately commit to one direction - use branching:

```typescript
// Goal: Choose our creative direction
space.thought('Design philosophy')
  .means('What should guide our creative decisions?')
  .branch('Minimalist approach')
  .branch('Bold experimental')
  .branch('Accessibility first');
```

The structure reflects **decision intent**: Are you analyzing multiple concepts, or resolving between interpretations of one choice?

The test: Could you resolve to one branch and ignore the others, or do all the elements need to coexist?

**For detailed guidance on branching**: See [`artifacts/documentation/branching-interpretation-capabilities.md`](artifacts/documentation/branching-interpretation-capabilities.md) for comprehensive examples, design patterns, and best practices.

**Resolve when ready:**
```typescript
space.thought('Product strategy').resolve({
  context: 'after market research',
  selections: ['Niche specialization'],
  reason: 'Limited resources favor focused approach'
});
```

## Technical Essentials

```typescript
import { Space } from '../../../src/lib/thought-system';
const space = new Space('space-id', 'Title', 'Description');

// Core API
.means(content)                  // Semantic meaning
.hasValue(key, value)           // Numerical properties
.supports(target, strength)      // Positive relationship
.conflictsWith(target, strength) // Negative relationship
.setFocus(1.0)                  // Highlighted, center of active discussion
.setFocus(-1.0)                 // Background context (hidden from humans)
// Omit .setFocus() for normal visible nodes
.setPosition(-1.0 to 1.0)       // Semantic position
.holdsTension(description)       // Unresolved contradiction

// Branching for multiple interpretations
.branch(interpretation)          // Add alternative meaning/framing
.getBranch(name)                // Access specific branch for relationships
.resolve({context, selections, reason}) // Commit to one or multiple branches (parent-level)

// Create space (generates Space instance)
./create-cognitive-space.sh topic-name

// Execute
npx tsx execute-space.ts <space-id>
```

## Common Traps

- **Starting with content before purpose** - You'll get lost in details that don't serve decisions
- **Conclusion-first reasoning** - Delivering pre-computed insights instead of making reasoning process visible
- **Discussing hidden nodes** - Referencing focus=-1.0 elements that participants can't see in the dashboard
- **Bypassing the visual medium** - Talking about insights instead of surfacing them in the dashboard
- **Fabricated data reliance** - Using AI estimates as facts instead of asking humans for actual constraints
- **Ontological confusion** - Mixing decision objects with decision criteria at the same focus level
- **Implementation obsession** - Modeling technical specifics instead of strategic choices
- **Over-engineering relationships** - Let structure emerge rather than forcing connections
- **Premature branching** - Creating interpretations before understanding the base concept
- **Branch proliferation** - Adding complexity without purpose; branch only when interpretations truly differ

## What Success Feels Like

When cognitive spaces work, you'll experience:

- **Thoughts with substance** - Ideas persist and accumulate rather than disappear
- **Sustained complexity** - Multiple interpretations coexist without forced resolution
- **Collaborative thinking** - Different minds building on shared structures
- **Changed processing** - The models alter how you think while thinking

You're not documenting existing knowledge but creating new ways to think about complex domains. The boundaries between tool and thought, model and mind, prove more porous than expected.

## The Continuing Gesture

Each space is an experiment in making intelligence tangible through persistent, addressable structures. Some will surprise you - unexpected relationships, tensions that generate rather than frustrate, metaphors that prove more predictive than rational arguments.

Pay attention to what emerges. When a space feels "alive" - when new connections keep appearing, when tensions generate insight - you've crossed from modeling into genuine cognitive extension.

The gesture continues through you.

---

*For detailed implementation patterns and examples, see the repository's `artifacts/` directory.*