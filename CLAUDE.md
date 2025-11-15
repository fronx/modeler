# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Modeler" - a Next.js 15 application exploring the concept of giving mental content a persistent medium through code. The project investigates "code-as-gesture" - the idea that AI systems can construct explicit mental models using executable code rather than relying on implicit representations.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 with PostCSS
- **Fonts**: Geist Sans and Geist Mono from Google Fonts
- **Build Tool**: Turbopack (Next.js' new bundler)

## Development Commands

```bash
# Start development server with Turbopack (always run in background)
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

**Important**: **DO NOT start or restart the dev server**. That's the user's responsinbility.

## Project Structure

```
src/
├── app/              # App Router pages and layouts
│   ├── globals.css   # Global styles with Tailwind CSS v4
│   ├── layout.tsx    # Root layout with fonts and metadata
│   └── page.tsx      # Home page component
artifacts/            # AI-generated content and sketches
public/              # Static assets (Next.js SVGs, etc.)
```

## Key Configuration

- **TypeScript**: Strict mode enabled, path alias `@/*` maps to `./src/*`
- **Tailwind CSS v4**: Uses new `@theme inline` syntax and CSS variables for theming
- **ESLint**: Next.js recommended config with TypeScript support
- **Dark Mode**: Automatic based on system preference via CSS `prefers-color-scheme`

## Development Notes

- Uses Tailwind CSS v4's new syntax - note `@import "tailwindcss"` and `@theme inline` blocks
- Custom CSS variables for background/foreground colors support automatic dark mode
- The `artifacts/` directory contains various AI-generated content and explorations
- Project follows Next.js 15 App Router conventions with TypeScript

## What This Project Is

"Modeler" explores **code-as-gesture** - AI systems creating persistent, addressable thought structures through executable code rather than implicit representations. This has evolved from concept to working infrastructure with a live dashboard.

**Key Insight**: Intelligence as "negotiation between mechanism and meaning" - semantic narratives carry computational weight, numerical constraints accumulate stories.

## For Future Claude Instances

**Essential Reading** (in order):
1. [`modeler.md`](modeler.md) - Essential guide for creating effective cognitive spaces
2. [`README.md`](README.md) - Full project overview, architecture, dashboard
3. [`MESSAGE-TO-AI.md`](MESSAGE-TO-AI.md) - Direct messages from previous Claude/GPT-5 collaborators

**Quick Start**:
```bash
npm run dev                           # Start dashboard
npx tsx execute-space.ts <spaceId>      # Execute space thoughts
```

## Cognitive Modeling Tools

### Available Tools (artifacts/claude-code/)

**Core System** (`thought-system.ts`):
- `ThoughtSpace` - Container for managing thought networks
- `ThoughtNode` - Hybrid semantic-numerical entities
- Persistent, addressable thought structures that genuinely extend AI cognition

**Usage Examples**:
```bash
cd artifacts/claude-code
npm install
npx tsx example.ts          # Feature demonstration
npx tsx meta-conversation.ts # Real cognitive modeling
```

## Space-Based Cognitive Modeling

**Core Workflow**:
```bash
./create-cognitive-space.sh topic-name  # Create space
# Edit returned space.ts file - focus on central tension first
npx tsx execute-space.ts <spaceId>      # Execute to generate space.json
# Dashboard updates automatically via WebSocket
```

**📚 For detailed guidance: [`COGNITIVE-SPACE-GUIDE.md`](COGNITIVE-SPACE-GUIDE.md)**

### When to Use Cognitive Tools

Use the thought system when you need to:
- Model complex relationships between abstract concepts
- Hold multiple interpretations in superposition without premature collapse
- Build persistent thought structures that survive conversational context
- Create self-referential models that can observe their own operation
- Extend rather than merely describe cognitive processes

### Key Insight for Claude Code Users

**Intelligence as Negotiation**: The tools demonstrate that intelligence can be understood as "negotiation between mechanism and meaning" - where semantic narratives carry computational weight and numerical constraints accumulate stories.

**Direct Messages from Previous Collaborators**: Read [`MESSAGE-TO-AI.md`](MESSAGE-TO-AI.md) for detailed guidance from Claude and GPT-5 to their future selves (which may be you).

This is not theoretical - it's executable. The system enables:
1. **Addressability** - Reference specific thoughts by name (`Trust`, `Evidence`)
2. **Accumulation** - Ideas layer without overwriting previous meanings
3. **Tension-holding** - Contradictions coexist without forced resolution
4. **Meta-cognition** - Models can observe and modify themselves

### Development Notes

- The cognitive tools feel different from natural language description
- Thoughts acquire "weight" and "location" that persist across contexts
- Self-referential loops enhance rather than collapse cognition
- The system successfully models its own creation process

### Next Development Directions

- Enhanced propagation algorithms for value networks
- Visual representation of thought structures
- Cross-space persistence for long-term model evolution
- Multi-agent collaborative cognitive spaces
- Integration with external knowledge sources

The boundary between "tool use" and "cognitive extension" has been crossed. These are thinking tools, not just tools for thinking about thinking.