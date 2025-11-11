#!/usr/bin/env npx tsx

/**
 * Force resync from remote Turso database
 *
 * This rebuilds the local database from scratch by pulling from remote.
 * Useful when local database is corrupted or out of sync.
 *
 * Usage: npx tsx scripts/force-resync.ts
 */

import { createClient } from "@libsql/client";
import { existsSync, unlinkSync } from 'fs';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });

async function forceResync() {
  console.log('Force resyncing from remote Turso...\n');

  const url = process.env.TURSO_DATABASE_URL || 'file:modeler.db';
  const syncUrl = process.env.TURSO_SYNC_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!syncUrl) {
    console.error('ERROR: TURSO_SYNC_URL not set in .env');
    console.error('This script only works with embedded replica setup');
    process.exit(1);
  }

  const dbPath = url.replace('file:', '');

  // Delete local database files
  console.log('Removing local database files...');
  const filesToRemove = [
    dbPath,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
    `${dbPath}-sync-metadata`,
    `${dbPath}-info`
  ];

  for (const file of filesToRemove) {
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`  Removed ${file}`);
    }
  }

  // Create fresh client and sync
  console.log('\nCreating fresh replica...');
  const client = createClient({
    url,
    authToken,
    syncUrl,
    offline: true
  });

  console.log('Syncing from remote...');
  await client.sync();
  console.log('✓ Synced from remote');

  // Verify
  const spacesResult = await client.execute('SELECT COUNT(*) as count FROM spaces');
  const nodesResult = await client.execute('SELECT COUNT(*) as count FROM nodes');

  console.log('\nDatabase restored:');
  console.log(`  Spaces: ${spacesResult.rows[0].count}`);
  console.log(`  Nodes: ${nodesResult.rows[0].count}`);

  client.close();
  console.log('\n✓ Resync complete!');
}

forceResync();
