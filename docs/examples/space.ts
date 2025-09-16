import { Space } from '../../src/lib/thought-system';

/**
 * Basic Space Example
 *
 * This demonstrates the fundamental patterns for creating cognitive models
 * using the Space-based API. Copy this structure for new explorations.
 */

const space = new Space(
  'basic-example-20250915',
  'Basic Cognitive Modeling Example',
  'Demonstrates core patterns: thoughts, relationships, values, metaphors, and tensions'
);

// 1. Simple thought with meaning and value
space.thought('Foundation')
  .means('The starting point for building cognitive models')
  .hasValue('stability', 0.9)
  .hasValue('importance', 0.8);

// 2. Related thoughts that build on each other
space.thought('Structure')
  .means('How thoughts connect and organize into coherent models')
  .hasValue('complexity', 0.6)
  .relatesTo('Foundation', 'builds-on', 0.8);

space.thought('Emergence')
  .means('Properties that arise from the interaction of thought structures')
  .hasValue('unpredictability', 0.7)
  .hasValue('insight-potential', 0.9)
  .relatesTo('Structure', 'transcends', 0.7)
  .relatesTo('Foundation', 'enables', 0.6);

// 3. Thought with multiple metaphorical interpretations
space.thought('Growth')
  .means('How cognitive models evolve and adapt over time')
  .hasValue('rate', [0.3, 0.8])  // Interval representing variability
  .relatesTo('Emergence', 'supports', 0.8)
  .forkMetaphor('organic', 'Growth as natural biological process', 1.1)
  .forkMetaphor('construction', 'Growth as deliberate building process', 0.9)
  .forkMetaphor('discovery', 'Growth as uncovering pre-existing patterns', 1.3);

// 4. Thought that holds tension between opposing forces
space.thought('Balance')
  .means('The dynamic equilibrium between different cognitive forces')
  .hasValue('tension-level', 0.5)
  .relatesTo('Growth', 'challenges', 0.6)
  .relatesTo('Structure', 'supports', 0.7)
  .holdsTension('Between rapid exploration and careful consolidation');

// 5. Self-referential thought (meta-cognition)
space.thought('SelfAwareness')
  .means('This model observing and understanding its own construction')
  .hasValue('recursion-depth', 0.8)
  .relatesTo('Balance', 'observes', 1.0)
  .relatesTo('Foundation', 'validates', 0.9)
  .holdsTension('Between being the observer and the observed');

// 6. Network effects - thoughts that connect multiple others
space.thought('Integration')
  .means('How individual thoughts combine into unified understanding')
  .hasValue('coherence', 0.85)
  .relatesTo('Structure', 'implements', 0.9)
  .relatesTo('Emergence', 'enables', 0.8)
  .relatesTo('SelfAwareness', 'fulfills', 0.7);

// Required: Export space for execution
if (require.main === module) {
  console.log(JSON.stringify(space.serialize(), null, 2));
}

export { space };