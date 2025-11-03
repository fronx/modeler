#!/usr/bin/env tsx

/**
 * Migration script to transfer all cognitive spaces from Postgres to Turso.
 *
 * This script reads all spaces from a Postgres database and writes them to a Turso database.
 * It preserves all space metadata, nodes, and history entries.
 *
 * Usage:
 *   npx tsx scripts/migrate-postgres-to-turso.ts
 *
 * Environment variables:
 *   # Source Postgres database (defaults to local)
 *   POSTGRES_HOST - default: 127.0.0.1
 *   POSTGRES_PORT - default: 54322
 *   POSTGRES_DATABASE - default: postgres
 *   POSTGRES_USER - default: postgres
 *   POSTGRES_PASSWORD - default: postgres
 *
 *   # Target Turso database
 *   TURSO_DATABASE_URL - default: file:modeler.db
 *   TURSO_AUTH_TOKEN - optional, for remote databases
 *   TURSO_SYNC_URL - optional, for embedded replicas
 *   ENABLE_VECTOR_SEARCH - default: true (set to 'false' to skip embeddings)
 *
 * Options:
 *   --dry-run    Show what would be migrated without actually migrating
 *   --space-id   Migrate only a specific space (useful for testing)
 */

import { Database } from '../src/lib/database';
import { TursoDatabase } from '../src/lib/turso-database';

interface MigrationOptions {
  dryRun: boolean;
  spaceId?: string;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    spaceId: args.find(arg => arg.startsWith('--space-id='))?.split('=')[1]
  };
}

async function migratePostgresToTurso() {
  const options = parseArgs();

  console.log('Postgres to Turso Migration');
  console.log('==========================\n');

  if (options.dryRun) {
    console.log('DRY RUN MODE - No data will be written\n');
  }

  if (options.spaceId) {
    console.log(`Migrating only space: ${options.spaceId}\n`);
  }

  // Connect to source database (Postgres)
  console.log('Connecting to Postgres...');
  const pgDb = new Database({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: parseInt(process.env.POSTGRES_PORT || '54322'),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  });

  // Connect to target database (Turso)
  console.log('Connecting to Turso...');
  const tursoDb = new TursoDatabase({
    url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl: process.env.TURSO_SYNC_URL,
    enableVectorSearch: process.env.ENABLE_VECTOR_SEARCH !== 'false'
  });

  try {
    // Get list of spaces to migrate
    let spacesToMigrate;

    if (options.spaceId) {
      const space = await pgDb.getSpace(options.spaceId);
      if (!space) {
        console.error(`\nError: Space ${options.spaceId} not found in Postgres`);
        process.exit(1);
      }
      spacesToMigrate = [{
        id: space.metadata.id,
        title: space.metadata.title,
        description: space.metadata.description,
        createdAt: space.metadata.createdAt,
        updatedAt: space.metadata.createdAt,
        nodeCount: Object.keys(space.nodes).length
      }];
    } else {
      spacesToMigrate = await pgDb.listSpaces();
    }

    console.log(`\nFound ${spacesToMigrate.length} space(s) to migrate\n`);

    if (spacesToMigrate.length === 0) {
      console.log('No spaces to migrate. Exiting.');
      return;
    }

    // Display migration plan
    console.log('Migration Plan:');
    console.log('---------------');
    for (const space of spacesToMigrate) {
      console.log(`  - ${space.title} (${space.id})`);
      console.log(`    Nodes: ${space.nodeCount}, Created: ${new Date(space.createdAt).toLocaleDateString()}`);
    }
    console.log();

    if (options.dryRun) {
      console.log('Dry run complete. No data was migrated.');
      return;
    }

    // Perform migration
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{spaceId: string, error: string}> = [];

    console.log('Starting migration...\n');

    for (let i = 0; i < spacesToMigrate.length; i++) {
      const spaceSummary = spacesToMigrate[i];
      const progress = `[${i + 1}/${spacesToMigrate.length}]`;

      try {
        console.log(`${progress} Migrating: ${spaceSummary.title}`);

        // Fetch full space data from Postgres
        const space = await pgDb.getSpace(spaceSummary.id);

        if (!space) {
          throw new Error('Space not found (may have been deleted during migration)');
        }

        // Insert into Turso
        await tursoDb.insertSpace(space);

        console.log(`${progress} ✓ Success - ${spaceSummary.nodeCount} nodes migrated`);
        successCount++;

      } catch (error: any) {
        console.error(`${progress} ✗ Failed: ${error.message}`);
        errorCount++;
        errors.push({
          spaceId: spaceSummary.id,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Migration Complete');
    console.log('='.repeat(50));
    console.log(`Total spaces: ${spacesToMigrate.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      for (const err of errors) {
        console.log(`  - ${err.spaceId}: ${err.error}`);
      }
      process.exit(1);
    }

    console.log('\n✓ All spaces migrated successfully!');

    if (process.env.ENABLE_VECTOR_SEARCH !== 'false') {
      console.log('\nNote: Vector embeddings were generated during migration.');
      console.log('Semantic search is now available via /api/search endpoints.');
    } else {
      console.log('\nNote: Vector search was disabled. Run with ENABLE_VECTOR_SEARCH=true to generate embeddings.');
    }

  } catch (error: any) {
    console.error('\nMigration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    console.log('\nClosing database connections...');
    await pgDb.close();
    await tursoDb.close();
  }
}

// Run migration
migratePostgresToTurso();
