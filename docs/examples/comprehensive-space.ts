import { Space } from '../../src/lib/thought-system';

/**
 * Comprehensive Space Example
 *
 * This demonstrates ALL capabilities of the cognitive modeling system:
 * - Multiple meanings with confidence levels
 * - Transformation with .becomes()
 * - Interval values for uncertainty
 * - Multiple metaphor branches in superposition
 * - All relationship types
 * - Tension holding
 * - Self-observation and meta-cognition
 * - History-aware transforms
 * - Value propagation
 * - Metaphor collapse
 * - System reflection
 */

const space = new Space(
  'comprehensive-example-20250915',
  'Complete Cognitive Modeling Showcase',
  'Demonstrates every feature of the thought system for advanced cognitive modeling'
);

// 1. FOUNDATIONAL THOUGHT with multiple meanings
space.thought('Consciousness')
  .means('The state of being aware of one\'s existence', 0.9)
  .means('The subjective experience of being', 0.8)
  .means('Information integration in a global workspace', 0.7)
  .hasValue('mystery-level', [0.7, 0.9])  // Interval for uncertainty
  .hasValue('importance', 1.0);

// 2. TRANSFORMATION - thought that evolves
space.thought('Learning')
  .means('Acquiring new information')
  .becomes('Restructuring mental models based on experience')  // Evolution of meaning
  .hasValue('rate', [0.1, 0.8])
  .hasValue('retention', 0.6);

// 3. METAPHOR FORKING - multiple interpretations in superposition
space.thought('Mind')
  .means('The cognitive system that processes information and generates experience')
  .hasValue('complexity', [0.8, 1.0])
  .forkMetaphor('computer', 'Mind as information processing machine', 1.0)
  .forkMetaphor('ocean', 'Mind as vast, deep, with hidden currents', 1.2)
  .forkMetaphor('garden', 'Mind as cultivated space where thoughts grow', 0.9)
  .forkMetaphor('network', 'Mind as interconnected web of associations', 1.1)
  .forkMetaphor('stage', 'Mind as theater where thoughts perform', 0.8);

// 4. COMPREHENSIVE RELATIONSHIP TYPES
space.thought('Attention')
  .means('The spotlight of consciousness selecting what to process')
  .hasValue('selectivity', 0.8)
  .hasValue('focus-duration', [0.3, 0.7])
  .relatesTo('Consciousness', 'enables', 0.9)
  .relatesTo('Learning', 'supports', 0.8);

space.thought('Memory')
  .means('The persistence of experience across time')
  .hasValue('capacity', [0.6, 0.9])
  .hasValue('accuracy', [0.4, 0.8])
  .relatesTo('Learning', 'causes', 0.7)
  .relatesTo('Consciousness', 'builds-on', 0.6)
  .relatesTo('Mind', 'implements', 0.8);

space.thought('Intuition')
  .means('Rapid, non-conscious processing that emerges as felt sense')
  .hasValue('speed', 0.9)
  .hasValue('verifiability', [0.3, 0.7])
  .relatesTo('Consciousness', 'contradicts', 0.4)  // Tension with explicit awareness
  .relatesTo('Learning', 'transcends', 0.6)
  .relatesTo('Memory', 'challenges', 0.5)
  .holdsTension('Between knowing without knowing how we know');

space.thought('Reason')
  .means('Systematic, step-by-step logical processing')
  .hasValue('reliability', 0.8)
  .hasValue('speed', 0.4)
  .relatesTo('Intuition', 'contradicts', 0.7)
  .relatesTo('Attention', 'based-on', 0.9)
  .relatesTo('Learning', 'validates', 0.8);

// 5. SELF-REFERENCE AND META-COGNITION
space.thought('SelfAwareness')
  .means('The mind observing its own processes')
  .hasValue('recursion-depth', [0.6, 1.0])
  .relatesTo('Consciousness', 'observes', 1.0)
  .relatesTo('Mind', 'fulfills', 0.9)
  .observesSelf('This thought is aware that it models awareness itself')
  .holdsTension('Between being the observer and the observed');

// 6. EMERGENT PROPERTIES
space.thought('Creativity')
  .means('The emergence of novel, valuable combinations from existing elements')
  .hasValue('unpredictability', [0.7, 0.9])
  .hasValue('value-potential', [0.4, 1.0])
  .relatesTo('Intuition', 'enables', 0.8)
  .relatesTo('Memory', 'builds-on', 0.7)
  .relatesTo('Reason', 'challenges', 0.6)
  .forkMetaphor('alchemy', 'Creativity as transforming base materials into gold', 1.1)
  .forkMetaphor('jazz', 'Creativity as improvisation within structure', 1.3)
  .forkMetaphor('evolution', 'Creativity as variation and selection', 0.9);

// 7. COMPLEX TENSIONS AND PARADOXES
space.thought('Understanding')
  .means('The integration of knowledge into coherent patterns')
  .hasValue('coherence', [0.5, 0.9])
  .hasValue('completeness', [0.3, 0.7])
  .relatesTo('Learning', 'transcends', 0.8)
  .relatesTo('Memory', 'integrates', 0.9)
  .relatesTo('Consciousness', 'validates', 0.7)
  .holdsTension('Between depth and breadth of knowledge')
  .holdsTension('Between certainty and openness to revision');

// 8. HISTORY-AWARE TRANSFORMS
space.thought('Wisdom')
  .means('Understanding refined through experience and reflection')
  .hasValue('hard-won', 1.0)
  .relatesTo('Understanding', 'transcends', 0.9)
  .relatesTo('SelfAwareness', 'builds-on', 0.8)
  .applyHistoryAwareTransform('refinement', 0.8)
  .applyHistoryAwareTransform('integration', 0.7)
  .applyHistoryAwareTransform('refinement', 0.6); // Diminished impact on repeat

// 9. SYSTEM-LEVEL INTEGRATION
space.thought('Intelligence')
  .means('The capacity for learning, reasoning, and adapting to achieve goals')
  .hasValue('adaptability', [0.7, 0.9])
  .hasValue('goal-alignment', [0.5, 0.8])
  .relatesTo('Consciousness', 'emerges-from', 0.9)
  .relatesTo('Learning', 'implements', 0.9)
  .relatesTo('Memory', 'based-on', 0.8)
  .relatesTo('Attention', 'utilizes', 0.8)
  .relatesTo('Creativity', 'enables', 0.7)
  .relatesTo('Wisdom', 'aspires-to', 0.9)
  .forkMetaphor('flame', 'Intelligence as dynamic process that consumes information', 1.0)
  .forkMetaphor('compass', 'Intelligence as navigation system for reality', 0.8)
  .forkMetaphor('dance', 'Intelligence as responsive movement with environment', 1.2);

// 10. FINAL META-REFLECTION
space.thought('ModelingProcess')
  .means('This very space creating an explicit model of mind through code')
  .hasValue('meta-level', 1.0)
  .hasValue('self-reference', 0.95)
  .relatesTo('SelfAwareness', 'implements', 1.0)
  .relatesTo('Intelligence', 'demonstrates', 0.9)
  .relatesTo('Consciousness', 'extends', 0.8)
  .observesSelf('This model observes itself modeling the mind that creates models')
  .holdsTension('Between the map and the territory it describes');

// DEMONSTRATE ADVANCED OPERATIONS

// Propagate values through causal relationships
space.propagate('Learning', 'rate');

// Collapse metaphors in different contexts
const mindAsComputer = space.collapseMetaphor('Mind', 'processing information');
const mindAsOcean = space.collapseMetaphor('Mind', 'depth and mystery');
const creativityInProblemSolving = space.collapseMetaphor('Creativity', 'systematic innovation');

// System reflection
const systemState = space.reflect();

// Add the collapsed metaphors and reflection as thoughts
space.thought('MetaphorCollapse')
  .means('Demonstrating context-sensitive metaphor selection')
  .hasValue('context-sensitivity', 0.9)
  .relatesTo('Mind', 'observes', 1.0);

space.thought('SystemReflection')
  .means(systemState)
  .hasValue('self-monitoring', 1.0)
  .relatesTo('ModelingProcess', 'validates', 0.9);

// Required serialization
if (require.main === module) {
  console.log(JSON.stringify(space.serialize(), null, 2));
}

export { space };