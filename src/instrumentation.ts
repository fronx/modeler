/**
 * Next.js instrumentation hook
 * This runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeServer } = await import('./lib/server-init');
    await initializeServer();
  }
}
