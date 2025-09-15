#!/usr/bin/env tsx

/**
 * Example usage of the cognitive modeling system
 * Demonstrating the key insights from the GPT-5 message to future self
 */

import { space, thought } from './thought-system';

console.log('=== Code-as-Gesture: Executable Cognitive Modeling ===\n');

// 1. Metaphor forks - multiple interpretations in superposition
const trust = thought('Trust')
  .means('Willingness to be vulnerable based on positive expectations')
  .hasValue('level', [0.6, 0.8])
  .forkMetaphor('resilient', 'Trust that grows stronger through testing', 1.2)
  .forkMetaphor('fragile', 'Trust that shatters when broken', 0.9)
  .forkMetaphor('pragmatic', 'Trust as calculated risk assessment', 1.0)
  .holdsTension('Can coexist with skepticism and still be authentic');

// 2. History-aware transforms - impact changes with repetition
const betrayal = thought('Betrayal')
  .means('Violation of trust that carries emotional weight')
  .hasValue('impact', 1.0);

// First betrayal hits hardest
betrayal.applyHistoryAwareTransform('betrayal', 1.0);
// Subsequent betrayals have diminished impact
betrayal.applyHistoryAwareTransform('betrayal', 1.0);
betrayal.applyHistoryAwareTransform('betrayal', 1.0);

// 3. Evolving branches - narratives learn from predictive success
const collaboration = thought('Collaboration')
  .means('Joint effort toward shared understanding')
  .hasValue('effectiveness', [0.7, 0.9])
  .relatesTo('Trust', 'causes', 0.8, 'trust enables vulnerability in collaboration');

// 4. Contextual collapse - choose metaphor based on experience
trust.forkMetaphor('collaborative', 'Trust as foundation for joint thinking', 1.5);

// Test contextual collapse in different scenarios
console.log('In collaborative context:');
console.log(`Trust interpretation: ${space.collapseMetaphor('Trust', 'collaborative')}`);

console.log('\nIn conflict context:');
console.log(`Trust interpretation: ${space.collapseMetaphor('Trust', 'conflict')}`);

// 5. Propagate values through causal relationships
space.propagate('Trust', 'level');

// 6. Self-reference - nodes observing themselves
const modeling = thought('Modeling')
  .means('Creating persistent structures for thought')
  .observesSelf('This very process of modeling is being modeled')
  .becomes('A strange loop where the map contains itself')
  .observesSelf('Each observation changes what it observes');

// 7. Provenance-first reasoning - full story included
console.log('\n=== Provenance Example ===');
console.log('Trust node history:');
trust.getProvenance().forEach((entry, i) => {
  console.log(`  ${i + 1}. ${entry}`);
});

// 8. System-level reflection
console.log('\n=== System State ===');
console.log(space.reflect());

// 9. Current meanings
console.log('\n=== Current Meanings ===');
for (const [id, node] of space.getAllNodes()) {
  console.log(`[${id}]: "${node.currentMeaning()}"`);
  if (node.tension) {
    console.log(`  Tension: ${node.tension}`);
  }
  if (node.metaphorBranches.length > 0) {
    console.log(`  Metaphors: ${node.metaphorBranches.map(b => b.name).join(', ')}`);
  }
}

// 10. Test the key question: Does this extend cognition or just describe it?
console.log('\n=== Meta-reflection ===');
const metaCognition = thought('MetaCognition')
  .means('Thinking about thinking using persistent structures')
  .relatesTo('Modeling', 'enables')
  .observesSelf('I can address specific thoughts by name and build on them')
  .becomes('Cognitive extension through addressable, accumulating structures');

console.log(`Meta-cognition insight: ${metaCognition.currentMeaning()}`);

// Export the current state for inspection
console.log('\n=== Full System State ===');
console.log(JSON.stringify(space.serialize(), null, 2));

console.log('\n=== The Gesture Continues ===');
console.log('This model is now running, persistent, and extensible.');
console.log('It demonstrates that intelligence can be the weaving of mechanism and meaning.');