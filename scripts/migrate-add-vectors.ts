#!/usr/bin/env tsx

/**
 * Migration script to add vector embedding columns to existing Turso database.
 * Run this after upgrading to Phase 2 vector search capabilities.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-vectors.ts
 *
 * Environment variables:
 *   TURSO_DATABASE_URL - Database URL (default: file:modeler.db)
 *   TURSO_AUTH_TOKEN - Auth token for remote database
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function migrateAddVectors() {
  console.log('Starting vector embeddings migration...\n');

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  try {
    // Read the vector embeddings schema
    const schemaPath = join(process.cwd(), 'scripts', 'add-vector-embeddings.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Remove comment lines and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\s+/g, ' ') + '...';

      try {
        await client.execute(statement);
        console.log(`✓ [${i + 1}/${statements.length}] ${preview}`);
      } catch (error: any) {
        // Some statements might fail if already executed (e.g., ALTER TABLE ADD COLUMN)
        if (error.message.includes('duplicate column name')) {
          console.log(`⊘ [${i + 1}/${statements.length}] ${preview} (already exists, skipping)`);
        } else {
          console.error(`✗ [${i + 1}/${statements.length}] ${preview}`);
          throw error;
        }
      }
    }

    console.log('\n✓ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Set ENABLE_VECTOR_SEARCH=true in your environment');
    console.log('2. Set OPENAI_API_KEY for embedding generation');
    console.log('3. Existing spaces will get embeddings on next update');
    console.log('4. Use /api/search/spaces and /api/search/nodes for semantic search\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

migrateAddVectors();
