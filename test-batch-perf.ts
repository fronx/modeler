import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

async function testBatchPerformance() {
  const statements = [];
  for (let i = 0; i < 13; i++) {
    statements.push({
      sql: 'SELECT 1',
      args: []
    });
  }

  // Test 1: Embedded replica WITH sync (offline: false - default)
  console.log('\n=== Test 1: Embedded Replica (offline: false - writes sync to remote) ===');
  const replicaClient = createClient({
    url: 'file:test-replica.db',
    syncUrl: process.env.TURSO_SYNC_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    offline: false
  });

  const t0 = Date.now();
  await replicaClient.batch(statements, 'write');
  const elapsed = Date.now() - t0;
  console.log(`Batch of 13 simple SELECTs: ${elapsed}ms`);
  replicaClient.close();

  // Test 2: Embedded replica with offline mode (offline: true)
  console.log('\n=== Test 2: Embedded Replica (offline: true - writes local only) ===');
  const offlineClient = createClient({
    url: 'file:test-offline.db',
    syncUrl: process.env.TURSO_SYNC_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    offline: true
  });

  const t1 = Date.now();
  await offlineClient.batch(statements, 'write');
  const elapsed2 = Date.now() - t1;
  console.log(`Batch of 13 simple SELECTs: ${elapsed2}ms`);
  offlineClient.close();

  // Test 3: Pure local (no syncUrl at all)
  console.log('\n=== Test 3: Pure Local (no syncUrl) ===');
  const localClient = createClient({
    url: 'file:test-local.db'
  });

  const t2 = Date.now();
  await localClient.batch(statements, 'write');
  const elapsed3 = Date.now() - t2;
  console.log(`Batch of 13 simple SELECTs: ${elapsed3}ms`);
  localClient.close();

  console.log(`\nSlowdown factors:`);
  console.log(`  offline:false vs offline:true = ${(elapsed / elapsed2).toFixed(1)}x`);
  console.log(`  offline:false vs pure local   = ${(elapsed / elapsed3).toFixed(1)}x`);
}

testBatchPerformance().catch(console.error);
