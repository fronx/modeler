#!/usr/bin/env node

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

async function executeSession(sessionId: string) {
  if (!sessionId) {
    console.error('Usage: npx tsx execute-session.ts <sessionId>');
    process.exit(1);
  }

  const sessionDir = path.join('data', 'sessions', sessionId);

  // Check if session directory exists
  try {
    await fs.access(sessionDir);
  } catch {
    console.error(`Error: Session directory not found: ${sessionDir}`);
    process.exit(1);
  }

  // Find TypeScript files (excluding ones starting with _), prioritizing session.ts
  try {
    const files = await fs.readdir(sessionDir);
    const tsFiles = files.filter(file =>
      file.endsWith('.ts') && !file.startsWith('_')
    );

    if (tsFiles.length === 0) {
      console.error(`Error: No TypeScript files found in ${sessionDir}`);
      process.exit(1);
    }

    // Prioritize session.ts if it exists, otherwise use first file found
    let tsFile = tsFiles.find(file => file === 'session.ts') || tsFiles[0];

    if (tsFiles.length > 1 && tsFile !== 'session.ts') {
      console.warn(`Warning: Multiple TypeScript files found, using: ${tsFile} (consider renaming to session.ts)`);
    }
    const tsFilePath = path.join(sessionDir, tsFile);
    const outputPath = path.join(sessionDir, 'session.json');

    console.log(`Executing session script: ${tsFilePath}`);

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

        // Write output to session.json
        try {
          await fs.writeFile(outputPath, stdout, 'utf8');
          console.log(`✅ Session output written to: ${outputPath}`);
          resolve();
        } catch (writeError) {
          console.error(`Error writing output: ${writeError}`);
          reject(writeError);
        }
      });
    });

  } catch (error) {
    console.error(`Error reading session directory: ${error}`);
    process.exit(1);
  }
}

// Get sessionId from command line arguments
const sessionId = process.argv[2];

executeSession(sessionId).catch((error) => {
  console.error('Execution failed:', error);
  process.exit(1);
});