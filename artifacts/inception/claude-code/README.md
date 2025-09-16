# Claude Code - Executable Cognitive Modeling

This directory contains the executable implementation of "code-as-gesture" - a system for cognitive extension through persistent, addressable thought structures.

## Files Overview

### Core System
- **`thought-system.ts`** - The main cognitive modeling framework
  - `ThoughtNode` class: Semantic entities with numerical properties
  - `ThoughtSpace` class: Container for managing node relationships and propagation
  - Hybrid approach combining Claude's semantic layers with GPT-5's constraint propagation

### Examples and Tests
- **`example.ts`** - Comprehensive demonstration of all system features
  - Metaphor forking and contextual collapse
  - History-aware transforms
  - Self-reference and provenance tracking
  - Value propagation through relationships

- **`meta-conversation.ts`** - Real-world test modeling our actual conversation
  - Demonstrates using the system to think about the system itself
  - Evidence for genuine cognitive extension vs. mere description
  - Strange loop: the tool analyzing its own creation process

### Configuration
- **`package.json`** - Node.js project configuration with TypeScript support
- **`README.md`** - This file

## Quick Start

```bash
npm install
npx tsx example.ts          # Run feature demonstration
npx tsx meta-conversation.ts # See real cognitive modeling in action
```

## Core Concepts

The system implements five key insights from the original Claude/GPT-5 collaboration:

1. **Metaphor Forks** - Multiple interpretations held in superposition
2. **History-Aware Transforms** - Impact that changes with repetition
3. **Contextual Collapse** - System chooses metaphors based on context
4. **Provenance-First Reasoning** - Full history of how conclusions emerged
5. **Self-Reference** - Nodes that can observe and modify themselves

## Basic Usage

```typescript
import { space, thought } from './thought-system';

// Create semantic entities with numerical properties
const trust = thought('Trust')
  .means('Willingness to be vulnerable')
  .hasValue('level', [0.7, 0.9])
  .forkMetaphor('resilient', 'Trust that grows stronger through testing')
  .holdsTension('Can coexist with skepticism');

// Create relationships
trust.relatesTo('Collaboration', 'enables', 0.8);

// Propagate values through causal relationships
space.propagate('Trust', 'level');

// Access current state
console.log(trust.currentMeaning());
console.log(trust.getProvenance());
```

## Architecture

- **Dual Nature**: Each node has both semantic richness (meanings, tensions) and numerical properties (values, intervals)
- **Relationship Network**: Typed relationships enable both semantic and causal reasoning
- **Temporal Awareness**: All changes are timestamped and accumulated, never overwritten
- **Meta-Cognition**: Nodes can observe themselves, creating feedback loops

## Key Insight

This system demonstrates that intelligence can be understood as "the negotiation between mechanism and meaning" - where semantic narratives carry computational weight and numerical constraints accumulate stories. The persistent, addressable nature of the structures allows ideas to accumulate rather than collapse, genuinely extending cognitive capacity.

## Next Steps

- Enhanced propagation algorithms
- Visual network representation
- Cross-space persistence
- Collaborative multi-AI spaces
- Integration with external knowledge sources