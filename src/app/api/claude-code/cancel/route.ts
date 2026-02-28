/**
 * Claude Code Cancel API endpoint
 * Stops the current Claude response via ClaudeManager.
 */

import { NextResponse } from 'next/server';
import { getClaudeManager } from '@/lib/claude-manager-singleton';
import type { CancelResponse } from '../types';

export async function POST() {
  try {
    const manager = getClaudeManager();
    manager.stop('modeler');

    return NextResponse.json<CancelResponse>({
      success: true,
      message: 'Operation cancelled',
    });
  } catch (error: any) {
    console.error('Cancel error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
