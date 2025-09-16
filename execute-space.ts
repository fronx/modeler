#!/usr/bin/env node

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

async function executeSpace(spaceId: string) {
  if (!spaceId) {
    console.error('Usage: npx tsx execute-space.ts <spaceId>');
    process.exit(1);
  }

  const spaceDir = path.join('data', 'spaces', spaceId);

  // Check if space directory exists
  try {
    await fs.access(spaceDir);
  } catch {
    console.error(`Error: Space directory not found: ${spaceDir}`);
    process.exit(1);
  }

  // Find TypeScript files (excluding ones starting with _), prioritizing space.ts
  try {
    const files = await fs.readdir(spaceDir);
    const tsFiles = files.filter(file =>
      file.endsWith('.ts') && !file.startsWith('_')
    );

    if (tsFiles.length === 0) {
      console.error(`Error: No TypeScript files found in ${spaceDir}`);
      process.exit(1);
    }

    // Prioritize space.ts if it exists, otherwise use first file found
    let tsFile = tsFiles.find(file => file === 'space.ts') || tsFiles[0];

    if (tsFiles.length > 1 && tsFile !== 'space.ts') {
      console.warn(`Warning: Multiple TypeScript files found, using: ${tsFile} (consider renaming to space.ts)`);
    }
    const tsFilePath = path.join(spaceDir, tsFile);
    const outputPath = path.join(spaceDir, 'space.json');

    console.log(`Executing space script: ${tsFilePath}`);

    // Execute the TypeScript file and capture output
    return new Promise<void>((resolve, reject) => {
      exec(`npx tsx "${tsFilePath}"`, {
        maxBuffer: 1024 * 1024, // 1MB buffer for large outputs
        cwd: process.cwd()
      }, async (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error: ${error.message}`);
          if (stderr) console.error(`stderr: ${stderr}`);
          reject(error);
          return;
        }

        if (stderr) {
          console.warn(`stderr: ${stderr}`);
        }

        // Validate JSON output
        try {
          JSON.parse(stdout);
        } catch (parseError) {
          console.error('Error: Output is not valid JSON');
          console.error('Output received:', stdout.substring(0, 200));
          reject(parseError);
          return;
        }

        // Write output to space.json atomically to avoid race conditions
        try {
          // Write to temporary file first, then rename (atomic operation)
          const tempPath = outputPath + '.tmp';
          await fs.writeFile(tempPath, stdout, 'utf8');
          await fs.rename(tempPath, outputPath);
          console.log(`✅ Space output written to: ${outputPath}`);

          // Notify WebSocket server immediately after successful write via HTTP
          try {
            const response = await fetch(`http://localhost:3002/api/spaces/${spaceId}/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              console.log(`📤 WebSocket update sent for space: ${spaceId}`);
            } else {
              console.log(`⚠️  Failed to send WebSocket update: ${response.status}`);
            }
          } catch (fetchError) {
            console.log(`⚠️  Could not reach WebSocket server: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          }

          resolve();
        } catch (writeError) {
          console.error(`Error writing output: ${writeError}`);
          reject(writeError);
        }
      });
    });

  } catch (error) {
    console.error(`Error reading space directory: ${error}`);
    process.exit(1);
  }
}

// Get spaceId from command line arguments
const spaceId = process.argv[2];

executeSpace(spaceId).catch((error) => {
  console.error('Execution failed:', error);
  process.exit(1);
});