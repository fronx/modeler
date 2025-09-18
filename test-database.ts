#!/usr/bin/env npx tsx

import { Database } from './src/lib/database.js';
import * as fs from 'fs';

async function main() {
  const db = new Database();

  try {
    // Load and insert Canada journey space
    const spaceFile = './data/spaces/canada-journey-prep-2025-09-18T10-33-52-3NZ/space.json';
    const spaceData = JSON.parse(fs.readFileSync(spaceFile, 'utf8'));

    console.log('Inserting space:', spaceData.metadata.title);
    await db.insertSpace(spaceData);

    // List spaces
    const spaces = await db.listSpaces();
    console.log('Spaces in database:');
    spaces.forEach(s => console.log(`  ${s.id}: ${s.title}`));

    // Retrieve space
    const retrieved = await db.getSpace(spaceData.metadata.id);
    if (retrieved) {
      const nodeCount = Object.keys(retrieved.thoughtSpace.nodes).length;
      console.log(`Retrieved space with ${nodeCount} nodes`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();