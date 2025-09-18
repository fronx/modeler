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

## Step-by-Step: Creating Your First Cognitive Space

### 1. Create a New Space

```bash
# Create via Next.js API
curl -X POST http://localhost:3000/api/spaces \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Canada Journey Preparation",
    "description": "Planning for upcoming travel to Canada - apartment, packing, and shopping"
  }'

# Returns: {"id": "canada-journey-prep-2025-09-18T10-33-52-3NZ", "title": "...", ...}
```

**What happens:**
- Generates unique timestamped space ID
- Creates JSON document in PostgreSQL JSONB
- Initializes empty thought space structure
- Space immediately available via dashboard and API

### 2. Define Your Space Purpose

Your generated JSON structure starts with metadata:

```json
{
  "metadata": {
    "id": "canada-journey-prep-2025-09-18T10-33-52-3NZ",
    "title": "Canada Journey Preparation",
    "description": "Planning for upcoming travel to Canada - apartment, packing, and shopping",
    "createdAt": 1695123456789
  },
  "thoughtSpace": {
    "nodes": {},
    "globalHistory": []
  }
}
```

### 3. Create Your First Thoughts

Add the main conceptual structure - usually 3-5 core thoughts that capture the essential tensions or categories:

```bash
# Add first thought
curl -X POST http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Apartment prep",
    "meanings": [{"content": "Getting home ready for departure and return", "confidence": 0.9, "timestamp": 1695123456789}],
    "focus": 1.0,
    "semanticPosition": -0.8
  }'

# Add second thought
curl -X POST http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Packing",
    "meanings": [{"content": "Selecting and organizing what to bring", "confidence": 0.9, "timestamp": 1695123456789}],
    "focus": 1.0,
    "semanticPosition": 0.0
  }'

# Add third thought
curl -X POST http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Shopping",
    "meanings": [{"content": "Items to buy for the journey", "confidence": 0.9, "timestamp": 1695123456789}],
    "focus": 1.0,
    "semanticPosition": 0.8
  }'
```

### 4. Add Properties and Lists

Use PATCH to enhance existing thoughts with specific values and actionable items:

```bash
# Add checkable list to apartment prep
curl -X PATCH http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ \
  -H "Content-Type: application/json" \
  -d '{
    "thoughtSpace": {
      "nodes": {
        "Apartment prep": {
          "checkableList": [
            {"item": "Take down hanging plants without plates", "checked": false},
            {"item": "Brief Susan on plant watering", "checked": true},
            {"item": "Tidy up living spaces", "checked": false}
          ]
        }
      }
    }
  }'

# Add values and list to shopping
curl -X PATCH http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ \
  -H "Content-Type: application/json" \
  -d '{
    "thoughtSpace": {
      "nodes": {
        "Shopping": {
          "values": {"estimated_cost": [50, 100]},
          "checkableList": [
            {"item": "Travel shampoo", "checked": false},
            {"item": "Contact lens solution (travel size)", "checked": false}
          ]
        }
      }
    }
  }'
```

### 5. Create Background Context

Add supporting information with `focus: -1.0` (hidden from dashboard but available for AI reasoning):

```bash
# Add background context with relationships
curl -X POST http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Trip duration",
    "meanings": [{"content": "10 days in Canada", "confidence": 0.9, "timestamp": 1695123456789}],
    "values": {"days": 10},
    "relationships": [
      {"type": "supports", "target": "Packing", "strength": 0.9},
      {"type": "supports", "target": "Shopping", "strength": 0.7}
    ],
    "focus": -1.0,
    "semanticPosition": 0.0
  }'

# Add budget constraints
curl -X POST http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Budget constraint",
    "meanings": [{"content": "Financial limits for the trip", "confidence": 0.9, "timestamp": 1695123456789}],
    "values": {"max_total": 500},
    "relationships": [
      {"type": "conflicts-with", "target": "Shopping", "strength": 0.6}
    ],
    "focus": -1.0,
    "semanticPosition": 0.0
  }'
```

### 6. View Your Space

```bash
# Open dashboard to see your space
open http://localhost:3000

# Or access via API
curl http://localhost:3000/api/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ
```

**Real-time updates:**
- Changes save automatically to PostgreSQL
- Dashboard updates instantly via WebSocket
- Multiple participants can collaborate simultaneously

## Essential Workflow Patterns

### 1. Choose Your Structural Approach

**Every modeling decision reflects conversational intent.** Are you exploring multiple concepts, or resolving between interpretations? This applies from initial purpose-setting through detailed content modeling.

**When choosing conversation approach** (pick one framing):
```json
{
  "Goal": {
    "meanings": [{"content": "What do we want to accomplish here?", "confidence": 0.9}],
    "branches": {
      "Get clarity on next steps": {"interpretation": "Focus on immediate actionable steps"},
      "Understand the bigger picture": {"interpretation": "Zoom out to see context and connections"},
      "Make a specific decision": {"interpretation": "Resolve to one clear choice"}
    }
  }
}
```

**When managing multiple agendas** (all need attention):
```json
{
  "Research": {
    "meanings": [{"content": "Gather information we need", "confidence": 0.9}]
  },
  "Build": {
    "meanings": [{"content": "Actually create the thing", "confidence": 0.9}]
  },
  "Test": {
    "meanings": [{"content": "Make sure it works", "confidence": 0.9}]
  }
}
```

The same principle applies at every level - purpose-setting, domain modeling, detailed planning.

### 2. Lists for Whole-Parts Relationships

**When a thought naturally contains parts** rather than alternatives, use lists instead of separate nodes:

```json
{
  "Shopping": {
    "meanings": [{"content": "Items to buy for the trip", "confidence": 0.9}],
    "checkableList": [
      {"item": "Travel shampoo", "checked": false},
      {"item": "Contact lens solution", "checked": true}
    ]
  },
  "Itinerary": {
    "meanings": [{"content": "Places we'll visit", "confidence": 0.9}],
    "regularList": ["Partner's mom's house", "Nature cabin", "Montreal"]
  }
}
```

Use `checkableList` for actionable items with completion tracking, `regularList` for reference items with bullets. One list per node - if you need multiple lists, create separate nodes.

### 3. Create Clean Foreground, Rich Background

**Foreground (focus=1.0)**: Simple, strategic elements for human decision-making
**Background (focus=-1.0)**: Complex context available for AI reasoning

```json
{
  "thoughtSpace": {
    "nodes": {
      "Downtown": {
        "focus": 1.0,
        "semanticPosition": -0.5,
        "values": {"cost": 2200},
        "meanings": [{"content": "Urban living option", "confidence": 0.9}]
      },
      "Suburbs": {
        "focus": 1.0,
        "semanticPosition": 0.5,
        "values": {"cost": 1800},
        "meanings": [{"content": "Suburban living option", "confidence": 0.9}]
      },
      "Remote": {
        "focus": 1.0,
        "semanticPosition": 0.0,
        "values": {"cost": 1200},
        "meanings": [{"content": "Remote living option", "confidence": 0.9}]
      },
      "Commute preference": {
        "focus": -1.0,
        "relationships": [
          {"type": "conflicts-with", "target": "Remote", "strength": 0.8},
          {"type": "supports", "target": "Downtown", "strength": 0.9}
        ],
        "meanings": [{"content": "Transportation preferences", "confidence": 0.8}]
      },
      "Budget constraint": {
        "focus": -1.0,
        "values": {"max_monthly": 2000},
        "relationships": [
          {"type": "conflicts-with", "target": "Downtown", "strength": 0.7}
        ],
        "meanings": [{"content": "Financial limitations", "confidence": 0.9}]
      },
      "Quality of life": {
        "focus": -1.0,
        "values": {"importance": 0.9},
        "relationships": [
          {"type": "supports", "target": "Suburbs", "strength": 0.8}
        ],
        "meanings": [{"content": "Life satisfaction factors", "confidence": 0.8}]
      }
    }
  }
}
```

Promote background elements to focus=1.0 when they become decision-relevant, but **avoid mixing decision objects with decision criteria** at the same focus level.

**Critical**: Never discuss or reference nodes with focus=-1.0 in conversation. If a hidden element becomes relevant to the discussion, first promote it to visible focus (either remove .setFocus() or set focus=1.0), then execute the space to update the dashboard before mentioning it.

### 4. Maintain Focus Hygiene

After adding new focus=1.0 nodes, always clean up by removing focus from nodes that are no longer central to the current decision. Limit focus=1.0 to the essential elements - too many focused nodes defeats the visual hierarchy.

```json
{
  "thoughtSpace": {
    "nodes": {
      "New decision": {
        "focus": 1.0,
        "meanings": [{"content": "Current decision point", "confidence": 0.9}]
      },
      "Previous decision": {
        "focus": 0.0,
        "meanings": [{"content": "Previously resolved choice", "confidence": 0.9}]
      },
      "Resolved tension": {
        "focus": 0.0,
        "meanings": [{"content": "No longer active conflict", "confidence": 0.9}]
      }
    }
  }
}
```

Execute the space to update the dashboard, ensuring only current decision elements remain highlighted.

### 5. Model Tensions, Not Details

Focus on strategic decisions and conceptual tensions. Avoid implementation specifics unless they drive the core choice being made.

```json
{
  "thoughtSpace": {
    "nodes": {
      "Incremental": {
        "semanticPosition": -1.0,
        "meanings": [{"content": "Gradual, step-by-step improvement approach", "confidence": 0.9}],
        "relationships": [
          {"type": "conflicts-with", "target": "Disruptive", "strength": 0.8}
        ]
      },
      "Disruptive": {
        "semanticPosition": 1.0,
        "meanings": [{"content": "Revolutionary, paradigm-shifting approach", "confidence": 0.9}]
      }
    }
  }
}

// Focus on strategic tensions, NOT implementation details
// Only add technical specifics if they drive the core strategic choice
```

### 6. Let Relationships Create Structure

Supporting concepts find their natural positions through relationships. Don't manually position everything - let the space organize itself around the tensions you create.

### 7. Structural Choice: Separate Nodes vs Branching

**Key decision**: Are these different ways of understanding the same thing, or different things that need to happen?

**The distinction depends on your conversational goal:**

If you're **exploring and comparing** design philosophies - learning about each, sharing examples, understanding their differences - model them as separate thoughts:

```json
{
  "thoughtSpace": {
    "nodes": {
      "Minimalist": {
        "meanings": [{"content": "Clean, reduced aesthetics", "confidence": 0.9}]
      },
      "Bold experimental": {
        "meanings": [{"content": "Striking, innovative visuals", "confidence": 0.9}]
      },
      "Accessibility first": {
        "meanings": [{"content": "Universal design principles", "confidence": 0.9}]
      }
    }
  }
}
```

If you're **making a strategic choice** about which philosophy should guide your project - where you'll ultimately commit to one direction - use branching:

```json
{
  "thoughtSpace": {
    "nodes": {
      "Design philosophy": {
        "meanings": [{"content": "What should guide our creative decisions?", "confidence": 0.9}],
        "branches": {
          "Minimalist approach": {
            "interpretation": "Focus on clean, reduced aesthetic choices",
            "isActive": true
          },
          "Bold experimental": {
            "interpretation": "Emphasize striking, innovative visual solutions",
            "isActive": true
          },
          "Accessibility first": {
            "interpretation": "Prioritize universal design principles",
            "isActive": true
          }
        }
      }
    }
  }
}
```

The structure reflects **decision intent**: Are you analyzing multiple concepts, or resolving between interpretations of one choice?

The test: Could you resolve to one branch and ignore the others, or do all the elements need to coexist?

**For detailed guidance on branching**: See [`artifacts/documentation/branching-interpretation-capabilities.md`](artifacts/documentation/branching-interpretation-capabilities.md) for comprehensive examples, design patterns, and best practices.

**Resolve when ready:**
```json
{
  "thoughtSpace": {
    "nodes": {
      "Product strategy": {
        "resolutions": [
          {
            "context": "after market research",
            "selections": ["Niche specialization"],
            "reason": "Limited resources favor focused approach",
            "timestamp": 1695123456789
          }
        ]
      }
    }
  }
}
```

## Technical Essentials

### JSON-First Architecture

Cognitive spaces are now **JSON documents** stored in PostgreSQL with real-time synchronization. This eliminates compilation barriers and enables direct editing of thought structures.

**Key Benefits:**
- **No compilation step** - Edit JSON directly
- **Real-time collaboration** - Multiple participants edit simultaneously
- **Database persistence** - PostgreSQL JSONB storage with rich querying
- **JSON Schema validation** - Maintains data integrity
- **WebSocket sync** - Instant dashboard updates

### Complete API Reference

#### Creating Spaces

**Create a new space:**
```bash
curl -X POST http://localhost:3000/api/spaces \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI-Human Collaboration Study",
    "description": "Exploring tensions and synergies in creative work"
  }'

# Returns: {"space": {"id": "2025-09-18T16-56-30-254Z", ...}, "message": "Space created successfully"}
```

#### Working with Thoughts

**Add individual thoughts:**
```bash
curl -X POST http://localhost:3000/api/spaces/SPACE_ID/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Artificial Intelligence",
    "meanings": [{"content": "AI capabilities and limitations", "confidence": 0.9, "timestamp": 1695123456789}],
    "focus": 1.0,
    "semanticPosition": -0.5,
    "values": {"importance": 0.8},
    "relationships": [{"type": "conflicts-with", "target": "Human Creativity", "strength": 0.6}]
  }'
```

**Add thoughts with lists:**
```bash
curl -X POST http://localhost:3000/api/spaces/SPACE_ID/thoughts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "Collaboration Tasks",
    "meanings": [{"content": "Areas of AI-human collaboration", "confidence": 0.9, "timestamp": 1695123456789}],
    "focus": 1.0,
    "checkableList": [
      {"item": "Content generation", "checked": false},
      {"item": "Code review", "checked": true}
    ],
    "relationships": [
      {"type": "supports", "target": "Artificial Intelligence", "strength": 0.7}
    ]
  }'
```

#### Updating Spaces

**Full space update (replace entire content):**
```bash
curl -X PUT http://localhost:3000/api/spaces/SPACE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {"id": "SPACE_ID", "title": "Updated Title", "description": "New description"},
    "thoughtSpace": {"nodes": {...}, "globalHistory": [...]}
  }'
```

**Partial space update (merge changes):**
```bash
curl -X PATCH http://localhost:3000/api/spaces/SPACE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {"description": "Updated description only"},
    "thoughtSpace": {"nodes": {"NewThought": {...}}}
  }'
```

#### Reading Data

**Get all spaces:**
```bash
curl -X GET http://localhost:3000/api/spaces
# Returns: {"spaces": [...], "count": 3}
```

**Get full space data:**
```bash
curl -X GET http://localhost:3000/api/spaces/SPACE_ID
# Returns complete space with metadata and all thoughts
```

**Get just the thoughts:**
```bash
curl -X GET http://localhost:3000/api/spaces/SPACE_ID/thoughts
# Returns: {"nodes": {...}, "spaceId": "...", "count": 3}
```

#### Real-time Features

- **Auto-save**: All changes persist immediately to PostgreSQL JSONB
- **WebSocket sync**: Dashboard updates automatically across all clients
- **JSON Schema validation**: All data validated against cognitive space schema
- **Conflict-free**: PATCH operations merge safely with existing data

### JSON Schema Validation

The system uses comprehensive JSON Schema validation (`src/lib/cognitive-space.schema.json`) to ensure data integrity:

```json
{
  "metadata": {
    "id": "space-identifier",
    "title": "Human-readable title",
    "description": "What this space explores",
    "createdAt": 1234567890
  },
  "thoughtSpace": {
    "nodes": {
      "NodeId": {
        "meanings": [{"content": "text", "confidence": 0.9}],
        "values": {"property": 42},
        "relationships": [{"type": "supports", "target": "Other", "strength": 0.8}],
        "focus": 1.0,
        "semanticPosition": 0.5
      }
    }
  }
}
```

### New Database Architecture Benefits

- **Real-time collaboration**: Multiple participants can edit simultaneously
- **Instant persistence**: Changes save automatically to PostgreSQL JSONB
- **No compilation barrier**: Direct JSON editing without TypeScript compilation
- **JSON Schema validation**: Maintains data integrity without compilation
- **Rich querying**: Database-level analysis of cognitive structures
- **Version history**: Full audit trail of cognitive evolution

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