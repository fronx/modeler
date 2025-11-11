/**
 * Test Claude CLI stream-json behavior with tool executions
 * This helps us understand:
 * 1. What messages are emitted during tool execution
 * 2. When the stream actually completes
 * 3. How to detect conversation completion
 */

import { spawn } from 'child_process';

interface StreamMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    role: string;
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: any;
    }>;
  };
  result?: string;
  permission_denials?: any[];
  [key: string]: any;
}

async function testClaudeStream(prompt: string, keepStdinOpen: boolean = false) {
  console.log('='.repeat(80));
  console.log('Testing Claude CLI with prompt:', prompt);
  console.log('Keep stdin open:', keepStdinOpen);
  console.log('='.repeat(80));

  const startTime = Date.now();
  let messageCount = 0;
  let toolUseCount = 0;
  let resultCount = 0;

  const claude = spawn('claude', [
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--allowedTools', 'Bash(npx tsx:*), Bash(echo:*), Bash(ls:*)'
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send message via stdin in stream-json format
  const message = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: prompt
    },
    parent_tool_use_id: null
  });

  claude.stdin?.write(message + '\n');

  // CRITICAL: Only close stdin if requested
  // Web integration keeps stdin open for persistent session
  if (!keepStdinOpen) {
    claude.stdin?.end();
  }

  claude.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());

    for (const line of lines) {
      try {
        const msg: StreamMessage = JSON.parse(line);
        messageCount++;

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n[${elapsed}s] Message #${messageCount}:`);
        console.log(`  Type: ${msg.type}${msg.subtype ? ` (${msg.subtype})` : ''}`);

        if (msg.type === 'system' && msg.subtype === 'init') {
          console.log(`  Session ID: ${msg.session_id}`);
        }

        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') {
              console.log(`  Text: ${block.text?.substring(0, 100)}...`);
            } else if (block.type === 'tool_use') {
              toolUseCount++;
              console.log(`  Tool Use #${toolUseCount}: ${block.name}`);
              console.log(`    ID: ${block.id}`);
              console.log(`    Input:`, JSON.stringify(block.input).substring(0, 100));
            }
          }
        }

        if (msg.type === 'result') {
          resultCount++;
          console.log(`  Result #${resultCount}: ${msg.result}`);
          if (msg.permission_denials && msg.permission_denials.length > 0) {
            console.log(`  Permission Denials: ${msg.permission_denials.length}`);
          }
        }

        // Log raw message for debugging
        console.log(`  Raw:`, JSON.stringify(msg).substring(0, 150));

      } catch (e) {
        // Non-JSON output
        console.log(`  [Non-JSON]: ${line.substring(0, 100)}`);
      }
    }
  });

  claude.stderr?.on('data', (data) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[${elapsed}s] STDERR:`, data.toString());
  });

  return new Promise<void>((resolve, reject) => {
    let resultReceived = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    // If keeping stdin open, set a timeout to simulate web integration timeout
    if (keepStdinOpen) {
      timeoutId = setTimeout(() => {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(80));
        console.log('⏱️  TIMEOUT after 30s - stream did not complete');
        console.log('SUMMARY:');
        console.log(`  Total Time: ${totalTime}s`);
        console.log(`  Messages Received: ${messageCount}`);
        console.log(`  Tool Uses: ${toolUseCount}`);
        console.log(`  Results: ${resultCount}`);
        console.log(`  Result Event Received: ${resultReceived}`);
        console.log('='.repeat(80));

        // Kill the process
        claude.kill('SIGTERM');
        resolve();
      }, 30000); // 30 second timeout
    }

    // Listen for result event
    claude.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const msg: StreamMessage = JSON.parse(line);
          if (msg.type === 'result') {
            resultReceived = true;
            console.log('\n✅ RESULT EVENT RECEIVED');

            // If keeping stdin open, we should close it now
            if (keepStdinOpen) {
              console.log('Closing stdin after result event...');
              claude.stdin?.end();
              cleanup();
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    claude.on('close', (code) => {
      cleanup();
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n' + '='.repeat(80));
      console.log('SUMMARY:');
      console.log(`  Exit Code: ${code}`);
      console.log(`  Total Time: ${totalTime}s`);
      console.log(`  Messages Received: ${messageCount}`);
      console.log(`  Tool Uses: ${toolUseCount}`);
      console.log(`  Results: ${resultCount}`);
      console.log(`  Result Event Received: ${resultReceived}`);
      console.log('='.repeat(80));
      resolve();
    });

    claude.on('error', (err) => {
      cleanup();
      console.error('Process error:', err);
      reject(err);
    });
  });
}

async function main() {
  // Test 1: Simple prompt with closed stdin (original behavior)
  console.log('\n\n📝 TEST 1: Simple prompt - stdin CLOSED after message (original)\n');
  await testClaudeStream('Say "hello" in one word', false);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Simple prompt with stdin kept open (web integration behavior)
  console.log('\n\n📝 TEST 2: Simple prompt - stdin KEPT OPEN (web integration)\n');
  await testClaudeStream('Say "hello" in one word', true);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Tool use with closed stdin
  console.log('\n\n📝 TEST 3: Tool use - stdin CLOSED (original)\n');
  await testClaudeStream('List files in the current directory using ls', false);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Tool use with stdin kept open (THIS IS THE CRITICAL TEST)
  console.log('\n\n📝 TEST 4: Tool use - stdin KEPT OPEN (web integration) ⚠️\n');
  await testClaudeStream('List files in the current directory using ls', true);
}

main().catch(console.error);
