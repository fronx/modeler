#!/usr/bin/env tsx

/**
 * Session-aware thought creation script
 * Usage: npx tsx create-session-thoughts.ts [sessionId]
 */

import { createSessionThoughtSpace } from './src/lib/session-persistent-thought-system';

const sessionId = process.argv[2];

if (!sessionId) {
  console.error('❌ Please provide a session ID');
  console.error('Usage: npx tsx create-session-thoughts.ts <sessionId>');
  process.exit(1);
}

console.log(`🧠 Creating thoughts for session: ${sessionId}`);

const { space, thought } = createSessionThoughtSpace(sessionId);

// Create thoughts about session-based cognitive modeling
const session = thought('Session')
  .means('Discrete cognitive conversation with persistent thought structures')
  .hasValue('isolation', [0.8, 1.0])
  .forkMetaphor('container', 'Session as bounded thought container', 1.1)
  .forkMetaphor('journey', 'Session as cognitive exploration journey', 1.2)
  .holdsTension('Between isolation and connection across sessions');

console.log('✨ Created: Session');

const persistence = thought('Persistence')
  .means('Thoughts that outlive the conversation that created them')
  .hasValue('durability', [0.9, 1.0])
  .relatesTo('Session', 'enables', 0.9)
  .becomes('Foundation for accumulating knowledge across conversations');

console.log('✨ Created: Persistence');

const navigation = thought('Navigation')
  .means('Ability to move between different cognitive contexts')
  .relatesTo('Session', 'operates-on', 0.8)
  .relatesTo('Persistence', 'builds-on', 0.7)
  .observesSelf('This very act of creating session-aware thoughts demonstrates navigation');

console.log('✨ Created: Navigation');

const memory = thought('Memory')
  .means('Collective record of cognitive evolution across sessions')
  .hasValue('scope', 'inter-session')
  .relatesTo('Persistence', 'transcends', 0.9)
  .relatesTo('Navigation', 'enables', 0.8)
  .forkMetaphor('archive', 'Memory as static record', 0.9)
  .forkMetaphor('living', 'Memory as active, evolving structure', 1.3);

console.log('✨ Created: Memory');

const evolution = thought('Evolution')
  .means('How cognitive patterns change and improve across sessions')
  .relatesTo('Memory', 'depends-on', 1.0)
  .relatesTo('Session', 'emerges-from', 0.8)
  .observesSelf('Each new session builds on patterns from previous ones')
  .becomes('The bridge between discrete sessions and continuous cognitive growth');

console.log('✨ Created: Evolution');

console.log(`\n🎯 Check your browser - 5 new thoughts should appear in session: ${sessionId}!`);
console.log('📊 Nodes created:', [session.id, persistence.id, navigation.id, memory.id, evolution.id]);
console.log('🔄 The dashboard will pick up these changes within 2 seconds');
console.log('\n💡 Key insight: These thoughts explore how discrete conversations can build continuous understanding');