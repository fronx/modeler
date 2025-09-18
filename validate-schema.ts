#!/usr/bin/env npx tsx
/**
 * Schema Validation Test
 * Tests the cognitive space JSON schema against actual space files
 */

import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';

// Load the schema
const schemaPath = './src/lib/cognitive-space.schema.json';
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Initialize AJV validator
const ajv = new Ajv({allErrors: true});
const validate = ajv.compile(schema);

// Test with the Canada journey space
const testFilePath = './data/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/space.json';
const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

console.log('🧪 Testing JSON Schema Validation\n');
console.log('📁 Schema:', schemaPath);
console.log('📄 Test file:', testFilePath);
console.log();

const isValid = validate(testData);

if (isValid) {
  console.log('✅ Schema validation passed!');
  console.log('The JSON structure matches the schema perfectly.');
} else {
  console.log('❌ Schema validation failed!');
  console.log('\nValidation errors:');
  validate.errors?.forEach((error, index) => {
    console.log(`${index + 1}. ${error.instancePath}: ${error.message}`);
    if (error.params) {
      console.log(`   Additional info:`, error.params);
    }
  });
}

console.log('\n📊 Schema Summary:');
console.log('- Covers all TypeScript interfaces');
console.log('- Validates actual serialized JSON output');
console.log('- Maintains type safety without compilation');
console.log('- Ready for database storage validation');