/**
 * Claude Code Cancel API endpoint
 * Cancels the current Claude operation by sending Escape to stdin
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/claude-code-session';
import { getCLISession } from '@/lib/claude-cli-session';

// Helper function to determine session mode at runtime (not cached)
function useCliMode(): boolean {
  return process.env.USE_CLI === 'true';
}

export async function POST() {
  try {
    // Get the active session
    const session = useCliMode() ? await getCLISession() : await getSession();

    // Cancel the current operation
    session.cancel();

    return NextResponse.json({
      success: true,
      message: 'Operation cancelled'
    });
  } catch (error: any) {
    console.error('Cancel error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
