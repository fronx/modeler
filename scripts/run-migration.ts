#!/usr/bin/env npx tsx
/**
 * Simple migration runner for Turso database
 * Usage: npx tsx scripts/run-migration.ts <migration-file.sql>
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file.sql>');
  process.exit(1);
}

const migrationPath = migrationFile.startsWith('/')
  ? migrationFile
  : join(process.cwd(), 'scripts', 'migrations', migrationFile);

console.log(`Running migration: ${migrationPath}`);

const url = process.env.TURSO_DATABASE_URL || 'file:modeler.db';
const syncUrl = process.env.TURSO_SYNC_URL;

async function runMigration() {
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl,
  });

  const sql = readFileSync(migrationPath, 'utf-8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 80) + '...');
    await client.execute(statement);
  }

  console.log('Migration completed successfully!');
  client.close();
}

runMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
