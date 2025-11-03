#!/usr/bin/env tsx

/**
 * Migration script to add vector embedding columns to existing Turso database.
 * Run this after upgrading to Phase 2 vector search capabilities.
 *
 * Handles both embedded replica setups (migrates both remote and local) and
 * single database setups (migrates just that database).
 *
 * Usage:
 *   npx tsx scripts/migrate-add-vectors.ts
 *
 * Environment variables (from .env file or shell):
 *   TURSO_DATABASE_URL - Database URL (default: file:modeler.db)
 *   TURSO_AUTH_TOKEN - Auth token for remote database
 *   TURSO_SYNC_URL - If set, will migrate both remote and local databases
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env file
config();

async function executeMigration(client: any, label: string) {
  console.log(`\nMigrating ${label}...`);

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
      if (error.message.includes('duplicate column name') ||
          error.message.includes('already exists')) {
        console.log(`⊘ [${i + 1}/${statements.length}] ${preview} (already exists, skipping)`);
      } else {
        console.error(`✗ [${i + 1}/${statements.length}] ${preview}`);
        throw error;
      }
    }
  }

  console.log(`✓ ${label} migration completed!`);
}

async function migrateAddVectors() {
  console.log('Starting vector embeddings migration...\n');

  const syncUrl = process.env.TURSO_SYNC_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const dbUrl = process.env.TURSO_DATABASE_URL || 'file:modeler.db';

  // Check if we're using embedded replicas
  if (syncUrl && dbUrl.startsWith('file:')) {
    console.log('Detected embedded replica setup - migrating both remote and local databases\n');

    // Remote database client
    const remoteUrl = syncUrl.replace('libsql://', 'https://');
    const remoteClient = createClient({
      url: remoteUrl,
      authToken
    });

    // Local database client
    const localClient = createClient({
      url: dbUrl
    });

    try {
      // 1. Migrate remote first
      await executeMigration(remoteClient, 'REMOTE DATABASE');

      // 2. Migrate local
      await executeMigration(localClient, 'LOCAL DATABASE');

      console.log('\n✓ All migrations completed successfully!');
    } catch (error) {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    } finally {
      remoteClient.close();
      localClient.close();
    }
  } else {
    // Single database setup
    console.log(`Migrating single database: ${dbUrl}\n`);

    const client = createClient({
      url: dbUrl,
      authToken
    });

    try {
      await executeMigration(client, 'DATABASE');
      console.log('\n✓ Migration completed successfully!');
    } catch (error) {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    } finally {
      client.close();
    }
  }

  console.log('\nNext steps:');
  console.log('1. Ensure ENABLE_VECTOR_SEARCH=true in your environment');
  console.log('2. Ensure OPENAI_API_KEY is set for embedding generation');
  console.log('3. Restart your application to pick up the schema changes');
  console.log('4. Existing spaces will get embeddings on next update');
  console.log('5. Use /api/search/spaces and /api/search/nodes for semantic search\n');
}

migrateAddVectors();
