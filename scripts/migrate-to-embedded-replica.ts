#!/usr/bin/env npx tsx

/**
 * Migrate local database to remote Turso for embedded replica setup
 *
 * This script:
 * 1. Reads all data from local modeler.db
 * 2. Pushes it to the remote Turso database
 * 3. Verifies the migration was successful
 *
 * Usage:
 *   npx tsx scripts/migrate-to-embedded-replica.ts
 *
 * Prerequisites:
 *   - TURSO_SYNC_URL must be set in .env (your remote database URL)
 *   - TURSO_AUTH_TOKEN must be set in .env
 *   - Local modeler.db file must exist with data to migrate
 */

import { createClient } from "@libsql/client";
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

interface MigrationStats {
  spaces: number;
  nodes: number;
  history: number;
}

async function migrate() {
  console.log('='.repeat(60));
  console.log('Migrating Local Database to Remote Turso');
  console.log('='.repeat(60));
  console.log();

  // Validate environment
  const syncUrl = process.env.TURSO_SYNC_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!syncUrl) {
    console.error('ERROR: TURSO_SYNC_URL not set in .env');
    console.error('Please set your remote Turso database URL');
    process.exit(1);
  }

  if (!authToken) {
    console.error('ERROR: TURSO_AUTH_TOKEN not set in .env');
    console.error('Please set your Turso authentication token');
    process.exit(1);
  }

  console.log(`Remote URL: ${syncUrl}`);
  console.log();

  // Create clients
  console.log('Connecting to databases...');
  const localClient = createClient({
    url: 'file:modeler.db'
  });

  const remoteClient = createClient({
    url: syncUrl,
    authToken
  });

  try {
    // Step 1: Initialize remote schema
    console.log('Initializing remote database schema...');
    const schemaPath = join(process.cwd(), 'scripts', 'init-turso-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await remoteClient.execute(statement);
    }
    console.log('✓ Remote schema initialized');
    console.log();

    // Step 2: Count local data
    console.log('Analyzing local data...');
    const spacesCount = await localClient.execute('SELECT COUNT(*) as count FROM spaces');
    const nodesCount = await localClient.execute('SELECT COUNT(*) as count FROM nodes');
    const historyCount = await localClient.execute('SELECT COUNT(*) as count FROM history');

    const stats: MigrationStats = {
      spaces: Number(spacesCount.rows[0].count),
      nodes: Number(nodesCount.rows[0].count),
      history: Number(historyCount.rows[0].count)
    };

    console.log(`  Spaces:  ${stats.spaces}`);
    console.log(`  Nodes:   ${stats.nodes}`);
    console.log(`  History: ${stats.history}`);
    console.log();

    if (stats.spaces === 0) {
      console.log('No data to migrate. Local database is empty.');
      return;
    }

    // Step 3: Migrate spaces
    console.log('Migrating spaces...');
    const spaces = await localClient.execute('SELECT * FROM spaces ORDER BY created_at');

    for (const space of spaces.rows) {
      await remoteClient.execute({
        sql: `
          INSERT INTO spaces (id, title, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            updated_at = excluded.updated_at
        `,
        args: [space.id, space.title, space.description, space.created_at, space.updated_at]
      });
    }
    console.log(`✓ Migrated ${stats.spaces} spaces`);

    // Step 4: Migrate nodes
    console.log('Migrating nodes...');
    const nodes = await localClient.execute('SELECT * FROM nodes ORDER BY created_at');

    for (const node of nodes.rows) {
      await remoteClient.execute({
        sql: `
          INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `,
        args: [node.id, node.space_id, node.node_key, node.data, node.created_at, node.updated_at]
      });
    }
    console.log(`✓ Migrated ${stats.nodes} nodes`);

    // Step 5: Migrate history
    console.log('Migrating history...');
    const history = await localClient.execute('SELECT * FROM history ORDER BY created_at');

    for (const entry of history.rows) {
      await remoteClient.execute({
        sql: `
          INSERT INTO history (id, space_id, entry, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            entry = excluded.entry
        `,
        args: [entry.id, entry.space_id, entry.entry, entry.created_at]
      });
    }
    console.log(`✓ Migrated ${stats.history} history entries`);
    console.log();

    // Step 6: Verify migration
    console.log('Verifying migration...');
    const remoteSpacesCount = await remoteClient.execute('SELECT COUNT(*) as count FROM spaces');
    const remoteNodesCount = await remoteClient.execute('SELECT COUNT(*) as count FROM nodes');
    const remoteHistoryCount = await remoteClient.execute('SELECT COUNT(*) as count FROM history');

    const remoteStats: MigrationStats = {
      spaces: Number(remoteSpacesCount.rows[0].count),
      nodes: Number(remoteNodesCount.rows[0].count),
      history: Number(remoteHistoryCount.rows[0].count)
    };

    console.log('Local  → Remote');
    console.log(`Spaces:  ${stats.spaces} → ${remoteStats.spaces}`);
    console.log(`Nodes:   ${stats.nodes} → ${remoteStats.nodes}`);
    console.log(`History: ${stats.history} → ${remoteStats.history}`);
    console.log();

    if (
      remoteStats.spaces === stats.spaces &&
      remoteStats.nodes === stats.nodes &&
      remoteStats.history === stats.history
    ) {
      console.log('✓ Migration successful!');
      console.log();
      console.log('Next steps:');
      console.log('1. Your remote database now has all your local data');
      console.log('2. You can now use embedded replicas by setting:');
      console.log('   TURSO_DATABASE_URL=file:modeler.db');
      console.log('   TURSO_SYNC_URL=<your-remote-url>');
      console.log('   TURSO_AUTH_TOKEN=<your-token>');
      console.log('   TURSO_SYNC_INTERVAL=60');
      console.log('3. On first sync, the remote data will download to your local file');
      console.log();
      console.log('IMPORTANT: Back up your modeler.db before enabling sync!');
    } else {
      console.error('ERROR: Migration verification failed!');
      console.error('Row counts do not match. Please investigate.');
      process.exit(1);
    }

  } catch (error) {
    console.error('ERROR during migration:', error);
    process.exit(1);
  } finally {
    localClient.close();
    remoteClient.close();
  }
}

migrate();
