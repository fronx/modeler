#!/usr/bin/env tsx

/**
 * Manually sync local embedded replica to remote Turso database.
 *
 * Usage:
 *   npx tsx scripts/sync-to-remote.ts
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';

config();

async function syncToRemote() {
  if (!process.env.TURSO_SYNC_URL) {
    console.error('✗ Error: TURSO_SYNC_URL not configured');
    console.error('This script is only needed for embedded replica setups\n');
    process.exit(1);
  }

  console.log('Syncing local database to remote...\n');

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl: process.env.TURSO_SYNC_URL
  });

  try {
    await client.sync();
    console.log('✓ Sync completed successfully!\n');
  } catch (error) {
    console.error('✗ Sync failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

syncToRemote();
