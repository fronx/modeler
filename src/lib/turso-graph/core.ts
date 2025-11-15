import { Client } from "@libsql/client";
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseCore {
  private initialized = false;
  private synced = false;

  constructor(
    private client: Client,
    private isEmbeddedReplica: boolean,
    private syncOnStartup: boolean,
    private syncFn: () => Promise<void>
  ) {}

  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      console.log('[DB] Already initialized, skipping');
      return;
    }

    console.log('[DB] Running initialization...');
    // Read and execute schema initialization
    const schemaPath = join(process.cwd(), 'scripts', 'init-turso-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Remove all comment lines and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))  // Remove comment-only lines
      .join('\n');

    // Split by semicolons and execute each statement
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Separate vector indices from other statements
    const vectorIndexStatements: string[] = [];
    const regularStatements: string[] = [];

    for (const statement of statements) {
      if (statement.includes('libsql_vector_idx')) {
        vectorIndexStatements.push(statement);
      } else {
        regularStatements.push(statement);
      }
    }

    // Execute regular statements first (tables and non-vector indices)
    for (const statement of regularStatements) {
      await this.client.execute(statement);
    }

    // Run column migrations for existing tables (add missing columns)
    // These will fail silently if columns already exist
    await this.runColumnMigrations();

    // Now execute vector index creation (depends on columns existing)
    for (const statement of vectorIndexStatements) {
      try {
        await this.client.execute(statement);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Only warn if it's not a "column doesn't exist" error
        // (which happens if vector search is disabled)
        if (!errorMsg.includes('no such column')) {
          console.warn(`Vector index creation warning: ${errorMsg}`);
        }
      }
    }

    // Perform startup sync if enabled and using embedded replica
    if (this.syncOnStartup && this.isEmbeddedReplica && !this.synced) {
      console.log('Performing startup sync to ensure database is up to date...');
      try {
        await this.syncFn();
        this.synced = true;
        console.log('Startup sync completed successfully');
      } catch (error) {
        console.error('Startup sync failed:', error);
        throw new Error(`Database initialization failed: unable to sync with remote. ${error}`);
      }
    }

    // Set initialized flag at the very end, after everything (including sync) completes
    this.initialized = true;
  }

  /**
   * Run column migrations to add missing columns to existing tables.
   * Silently ignores errors if columns already exist (duplicate column errors).
   */
  private async runColumnMigrations(): Promise<void> {
    const migrations = [
      // Add vector embedding columns to spaces table (if they don't exist)
      'ALTER TABLE spaces ADD COLUMN title_embedding F32_BLOB(768)',
      'ALTER TABLE spaces ADD COLUMN description_embedding F32_BLOB(768)',
      // Add vector embedding columns to nodes table (if they don't exist)
      'ALTER TABLE nodes ADD COLUMN title_embedding F32_BLOB(768)',
      'ALTER TABLE nodes ADD COLUMN full_embedding F32_BLOB(768)',
    ];

    for (const migration of migrations) {
      try {
        await this.client.execute(migration);
      } catch (error) {
        // Ignore "duplicate column" errors - column already exists
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('duplicate column')) {
          console.warn(`Migration warning: ${errorMsg}`);
        }
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  resetInitialized(): void {
    this.initialized = false;
  }
}
