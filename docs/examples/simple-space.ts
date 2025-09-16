import { Space } from '../../src/lib/thought-system';

/**
 * Simple Space Example
 *
 * This demonstrates the basic building blocks of cognitive modeling.
 * Perfect for getting started or quick prototyping.
 */

const space = new Space(
  'simple-example-20250915',
  'Simple Cognitive Model',
  'Basic thoughts, values, and relationships'
);

// 1. Create a thought with meaning and value
space.thought('Idea')
  .means('A new concept forming in the mind')
  .hasValue('clarity', 0.7);

// 2. Create a related thought
space.thought('Understanding')
  .means('Grasping the essence of the idea')
  .hasValue('depth', 0.8)
  .relatesTo('Idea', 'builds-on', 0.9);

// 3. Add a thought with tension
space.thought('Uncertainty')
  .means('The space between knowing and not knowing')
  .hasValue('comfort-level', 0.3)
  .relatesTo('Understanding', 'challenges', 0.6)
  .holdsTension('Between curiosity and anxiety');

// Required serialization
if (require.main === module) {
  console.log(JSON.stringify(space.serialize(), null, 2));
}

export { space };