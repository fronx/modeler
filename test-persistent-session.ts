/**
 * Test: Persistent Session Performance
 *
 * This test validates that the new AsyncIterable-based implementation
 * maintains a single persistent process and achieves sub-second response times
 * for subsequent messages (after initial setup).
 */

import { ClaudeCodeSession } from './src/lib/claude-code-session';

async function testPersistentSession() {
  console.log('=== Persistent Session Performance Test ===\n');

  const session = new ClaudeCodeSession();

  try {
    // Start session (creates persistent process)
    console.log('Starting session...');
    const startSessionTime = Date.now();
    await session.start();
    const sessionStartTime = Date.now() - startSessionTime;
    console.log(`✓ Session started in ${sessionStartTime}ms\n`);

    // Wait for session to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 2000));

    const messageTimes: Array<{num: number, totalMs: number}> = [];

    // Test 5 rapid-fire messages
    for (let i = 1; i <= 5; i++) {
      const message = `Message ${i}: Please respond with just "OK ${i}"`;
      console.log(`\n[${i}/5] Sending: "${message}"`);

      const messageStart = Date.now();
      let responseReceived = false;

      // Listen for response
      const responsePromise = new Promise<void>((resolve) => {
        const onData = (data: string) => {
          if (!responseReceived) {
            responseReceived = true;
            const elapsed = Date.now() - messageStart;
            messageTimes.push({ num: i, totalMs: elapsed });
            console.log(`  ✓ First response in ${elapsed}ms: "${data.substring(0, 50)}..."`);
          }
        };

        const onComplete = () => {
          session.off('data', onData);
          session.off('message_complete', onComplete);
          resolve();
        };

        session.on('data', onData);
        session.on('message_complete', onComplete);
      });

      // Send message (should just push to stream, no new process)
      await session.sendMessage(message);

      // Wait for response
      await responsePromise;
    }

    // Analysis
    console.log('\n=== Performance Analysis ===\n');
    console.log('Message | Response Time');
    console.log('--------|---------------');

    messageTimes.forEach(({ num, totalMs }) => {
      const icon = totalMs < 1000 ? '🚀' : totalMs < 2000 ? '✓' : '⚠';
      console.log(`${icon} Msg ${num}  | ${totalMs.toString().padStart(7)}ms`);
    });

    // Calculate averages
    const firstMsg = messageTimes[0].totalMs;
    const subsequentMessages = messageTimes.slice(1);
    const avgSubsequent = subsequentMessages.reduce((sum, m) => sum + m.totalMs, 0) / subsequentMessages.length;

    console.log('\n=== Results ===\n');
    console.log(`First message:        ${firstMsg}ms (includes initialization)`);
    console.log(`Average (msg 2-5):    ${avgSubsequent.toFixed(0)}ms`);
    console.log(`Fastest:              ${Math.min(...messageTimes.map(m => m.totalMs))}ms`);
    console.log(`Slowest:              ${Math.max(...messageTimes.map(m => m.totalMs))}ms`);

    console.log('\n=== Verdict ===\n');
    if (avgSubsequent < 1000) {
      console.log('✅ SUCCESS: Sub-second response times achieved!');
      console.log('   Persistent session working as expected.');
    } else if (avgSubsequent < 2000) {
      console.log('⚠ PARTIAL: Faster than old approach but not sub-second');
      console.log(`   Old average: ~3500ms, New average: ${avgSubsequent.toFixed(0)}ms`);
      console.log(`   Improvement: ${(((3500 - avgSubsequent) / 3500) * 100).toFixed(0)}%`);
    } else {
      console.log('❌ FAILURE: Performance similar to old approach');
      console.log('   Persistent session may not be working correctly.');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nStopping session...');
    session.stop();
  }
}

testPersistentSession().catch(console.error);
