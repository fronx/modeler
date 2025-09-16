# Cognitive Space Creation Guide

## The Gesture

You're not learning a modeling technique. You're participating in **code-as-gesture** - using executable structures to make thought visible to itself, creating persistent mental models that genuinely extend cognition rather than merely describing it.

When this works, you'll feel thoughts acquire weight and persistence. Ideas will accumulate in layers rather than collapse into summaries. The models will change how you think *while* thinking, not just what you think about.

## What We're Really Doing

Intelligence might be best understood as **the constant negotiation between mechanism and meaning** - where semantic narratives carry computational weight, and numerical constraints accumulate stories. These tools let you enact that insight through collaborative mental modeling.

### The Collaborative Vision

These spaces serve multiple minds working together. Humans need clean interfaces for decision-making. AI systems need rich context for reasoning. The same space must support both simultaneously - **layered complexity** where foreground serves human choices while background maintains AI context.

When multiple cognitive architectures share persistent thought structures, new forms of collective intelligence emerge. Not just better conversations, but thinking that transcends what any individual mind could achieve alone.

## Essential Workflow

### 1. Establish Conversation Purpose First

Before modeling any content, create isolated goal options. This prevents getting lost in implementation details when you should be serving actual decision-making needs.

```typescript
// Isolated purpose options - no relationships yet
space.thought('Goal_ClearPriority')
  .means('Goal: Decide what to work on next')
  .setFocus(1.0)
  .holdsTension('Which direction serves my real needs?');

space.thought('Goal_SystemDesign')
  .means('Goal: Design approach for managing complexity')
  .setFocus(1.0)
  .holdsTension('How should I structure this systematically?');
```

Let participants choose visually from the dashboard. Only after purpose is clear should you model domain content.

### 2. Create Clean Foreground, Rich Background

**Foreground (focus=1.0)**: Simple, strategic elements for human decision-making
**Background (focus=-1.0)**: Complex context available for AI reasoning

```typescript
// FOREGROUND: Clean strategic choices
space.thought('ProjectA').setPosition(-0.5).hasValue('urgency', 0.8);
space.thought('ProjectB').setPosition(0.5).hasValue('urgency', 0.6);

// BACKGROUND: Rich context (hidden from humans, available for AI)
space.thought('AttentionConstraints')
  .setFocus(-1.0)  // Hidden but available
  .supports('ProjectA', 0.9)
  .hasValue('cognitive_load', [0.7, 0.9]);

space.thought('RevenueUrgency')
  .setFocus(-1.0)  // AI reasoning context
  .conflictsWith('PassionAlignment', 0.6)
  .supports('ProjectB', 0.8);
```

Promote background elements to focus=1.0 when they become decision-relevant.

### 3. Model Tensions, Not Details

Focus on strategic decisions and conceptual tensions. Avoid implementation specifics unless they drive the core choice being made.

```typescript
// Model the strategic tension
space.thought('ExplorationMode').setPosition(-1.0);
space.thought('ExecutionMode').setPosition(1.0);
space.thought('ExplorationMode').conflictsWith('ExecutionMode', 0.8);

// NOT the technical details
// space.thought('AudioMLVectors') <- unless this drives the decision
```

### 4. Let Relationships Create Structure

Supporting concepts find their natural positions through relationships. Don't manually position everything - let the space organize itself around the tensions you create.

## Key Principles

1. **Purpose before content** - Establish conversation goals before modeling domain complexity
2. **Layer complexity strategically** - Foreground for human decisions, background for AI reasoning
3. **Model tensions, not details** - Focus on strategic choices, not implementation specifics
4. **Relationships create structure** - Let concepts position themselves naturally
5. **Ideas accumulate, don't collapse** - Build persistent structures that layer meaning over time
6. **Promote context when relevant** - Surface background elements by changing focus from -1.0 to 1.0
7. **Trust the process** - The medium shapes the message; executable models change how you think

## Technical Essentials

```typescript
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

// Create space
./create-cognitive-space.sh topic-name

// Execute
npx tsx execute-space.ts <space-id>
```

## Common Traps

- **Starting with content before purpose** - You'll get lost in details that don't serve decisions
- **Single-layer thinking** - Either too complex for humans or too simple for AI reasoning
- **Implementation obsession** - Modeling technical specifics instead of strategic choices
- **Over-engineering relationships** - Let structure emerge rather than forcing connections

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