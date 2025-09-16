# Cognitive Modeling Examples

This directory contains canonical examples demonstrating different patterns and capabilities of the Space-based cognitive modeling system.

## Quick Start

### Running an Example

```bash
# From the project root directory
npx tsx docs/examples/space.ts

# Or use the space execution system
cp docs/examples/space.ts data/spaces/example-space/space.ts
npx tsx execute-space.ts example-space
```

### Creating Your Own Space

1. **Copy the basic pattern**:
   ```bash
   cp docs/examples/space.ts data/spaces/my-space/space.ts
   ```

2. **Modify for your exploration**:
   - Change space metadata (id, title, description)
   - Replace example thoughts with your concepts
   - Adjust relationships and values

3. **Execute and visualize**:
   ```bash
   npx tsx execute-space.ts my-space
   npm run dev  # View in dashboard
   ```

## Available Examples

### [`simple-space.ts`](simple-space.ts)
**Purpose**: Quick introduction to basic cognitive modeling
**Patterns Covered**:
- Creating thoughts with meanings and values
- Basic relationships between thoughts
- Tension holding
- Perfect for first-time users

### [`space.ts`](space.ts)
**Purpose**: Demonstrates fundamental patterns for cognitive modeling
**Patterns Covered**:
- Simple thoughts with meanings and values
- Relationship building (`relatesTo`)
- Multiple metaphorical interpretations (`forkMetaphor`)
- Tension holding (`holdsTension`)
- Self-referential meta-cognition
- Network integration effects
- Good balance of features without overwhelming complexity

### [`comprehensive-space.ts`](comprehensive-space.ts)
**Purpose**: Complete showcase of ALL cognitive modeling capabilities
**Advanced Features Demonstrated**:
- Multiple meanings with confidence levels
- Thought transformation (`.becomes()`)
- Interval values for uncertainty
- All relationship types
- Metaphor forking and collapse
- Self-observation and meta-cognition
- History-aware transforms
- Value propagation through networks
- System reflection and monitoring
- Complex multi-layered tensions
- Use this as a reference for advanced cognitive modeling

### Core API Patterns

#### 1. Creating Thoughts
```typescript
space.thought('ConceptName')
  .means('What this concept represents')
  .hasValue('property', 0.8);
```

#### 2. Building Relationships
```typescript
space.thought('SecondConcept')
  .relatesTo('ConceptName', 'supports', 0.9);
```

**Relationship Types**:
- `'supports'` - One concept reinforces another
- `'builds-on'` - One concept extends another
- `'challenges'` - One concept questions another
- `'enables'` - One concept makes another possible
- `'transcends'` - One concept goes beyond another
- `'observes'` - One concept watches another
- `'implements'` - One concept realizes another
- `'fulfills'` - One concept completes another
- `'validates'` - One concept confirms another

#### 3. Metaphorical Interpretations
```typescript
space.thought('GrowthConcept')
  .forkMetaphor('organic', 'Like biological growth', 1.2)
  .forkMetaphor('construction', 'Like building', 0.9);
```

#### 4. Holding Tensions
```typescript
space.thought('Paradox')
  .holdsTension('Between stability and change');
```

#### 5. Value Intervals
```typescript
space.thought('Variable')
  .hasValue('uncertainty', [0.3, 0.8]);  // Range of possible values
```

## Best Practices

### Structure Your Exploration

1. **Start with Foundation**: Create core concepts first
2. **Build Relationships**: Connect concepts with meaningful relationships
3. **Add Nuance**: Use metaphors and tensions for complexity
4. **Include Meta-cognition**: Add thoughts that observe the model itself
5. **Create Integration**: Add concepts that tie everything together

### Naming Conventions

- **Thoughts**: Use PascalCase for concept names (`CodeAsGesture`, `MetaCognition`)
- **Values**: Use kebab-case for properties (`stability`, `growth-rate`, `meta-level`)
- **Spaces**: Use descriptive IDs with timestamps (`exploration-20250915`, `meta-analysis-space`)

### Value Guidelines

- **0.0 - 0.3**: Low/weak/uncertain
- **0.4 - 0.6**: Moderate/developing
- **0.7 - 0.9**: High/strong/confident
- **1.0+**: Exceptional/breakthrough/transcendent

### Relationship Strengths

- **0.1 - 0.3**: Weak connection
- **0.4 - 0.6**: Moderate relationship
- **0.7 - 0.9**: Strong connection
- **1.0+**: Fundamental/essential relationship

## Advanced Patterns

### Multiple Meanings with Confidence
Add layered meanings with different confidence levels:

```typescript
space.thought('Consciousness')
  .means('Subjective experience of being', 0.9)
  .means('Information integration in global workspace', 0.7)
  .means('Emergent property of neural complexity', 0.6);
```

### Thought Transformation
Let thoughts evolve their meaning:

```typescript
space.thought('Learning')
  .means('Acquiring new information')
  .becomes('Restructuring mental models based on experience');
```

### Self-Observation
Thoughts that can observe themselves:

```typescript
space.thought('SelfAware')
  .means('A thought that knows it thinks')
  .observesSelf('This thought observes its own recursive nature');
```

### History-Aware Transforms
Transformations that weaken with repetition:

```typescript
space.thought('Concept')
  .applyHistoryAwareTransform('refinement', 0.8)
  .applyHistoryAwareTransform('refinement', 0.6); // Diminished effect
```

### Value Propagation
Spread values through causal relationships:

```typescript
space.thought('Cause')
  .hasValue('strength', 0.8)
  .relatesTo('Effect', 'causes', 0.9);

space.propagate('Cause', 'strength'); // Effect gets value 0.72
```

### Metaphor Collapse
Choose best metaphor based on context:

```typescript
space.thought('Mind')
  .forkMetaphor('computer', 'Processing machine', 1.0)
  .forkMetaphor('ocean', 'Deep and mysterious', 1.2);

const interpretation = space.collapseMetaphor('Mind', 'processing data');
// Returns computer metaphor in computational context
```

### System Reflection
Get insights about the thought space:

```typescript
const reflection = space.reflect();
// "ThoughtSpace contains 5 nodes, 12 meanings, 8 relationships"
```

### Multi-Metaphor Competition
Let different interpretations compete:

```typescript
space.thought('AmbiguousConcept')
  .forkMetaphor('interpretation1', 'First way of seeing it', 0.9)
  .forkMetaphor('interpretation2', 'Competing perspective', 1.1)
  .forkMetaphor('synthesis', 'Higher-order integration', 1.3);
```

### Network Dynamics
Create concepts that emerge from relationships:

```typescript
space.thought('EmergentProperty')
  .means('Something that arises from the network itself')
  .relatesTo('Node1', 'emerges-from', 0.8)
  .relatesTo('Node2', 'emerges-from', 0.8)
  .relatesTo('Node3', 'emerges-from', 0.8);
```

## Troubleshooting

### Common Issues

1. **Module Import Errors**: Ensure you're using the correct relative path to `src/lib/thought-system`
2. **Missing Serialization**: Always end your file with the `if (require.main === module)` block
3. **Relationship Errors**: Make sure target thoughts exist before referencing them
4. **TypeScript Errors**: Check that all method calls are properly chained

### Debugging Spaces

```bash
# Test TypeScript compilation
npx tsc --noEmit docs/examples/space.ts

# Run directly to see output
npx tsx docs/examples/space.ts

# Check space execution
npx tsx execute-space.ts space-id --verbose
```

## Contributing Examples

When adding new examples:

1. **Document the purpose**: Clear comment about what pattern is demonstrated
2. **Follow naming conventions**: Consistent with existing examples
3. **Include variety**: Show different relationship types and value patterns
4. **Add to this README**: Update the examples list and any new patterns
5. **Test thoroughly**: Ensure the example executes and produces valid JSON