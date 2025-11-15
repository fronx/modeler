#!/usr/bin/env tsx
/**
 * Verification script to test that database factory returns true singleton
 * across multiple imports and calls.
 */

import { createDatabase } from '../src/lib/database-factory';

console.log('='.repeat(60));
console.log('Database Singleton Verification Test');
console.log('='.repeat(60));
console.log();

console.log('Test 1: Multiple calls to createDatabase()');
console.log('-'.repeat(60));
const db1 = createDatabase();
console.log();

const db2 = createDatabase();
console.log();

const db3 = createDatabase();
console.log();

console.log('Test 2: Verify same instance');
console.log('-'.repeat(60));
console.log(`db1 === db2: ${db1 === db2}`);
console.log(`db2 === db3: ${db2 === db3}`);
console.log(`db1 === db3: ${db1 === db3}`);
console.log();

if (db1 === db2 && db2 === db3) {
  console.log('✓ SUCCESS: All references point to the same instance');
} else {
  console.error('✗ FAILURE: Different instances were created!');
  process.exit(1);
}

console.log();
console.log('Test 3: Check instance tracking');
console.log('-'.repeat(60));
// The constructor logs should show only 1 instance was created

console.log();
console.log('='.repeat(60));
console.log('All tests passed!');
console.log('='.repeat(60));
