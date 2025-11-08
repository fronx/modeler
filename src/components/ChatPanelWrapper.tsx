'use client';

import React, { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { ChatPanelClaudeCode } from './ChatPanelClaudeCode';

interface ChatPanelWrapperProps {
  spaceId?: string | null;
}

type ChatMode = 'llm' | 'claude-code';

export const ChatPanelWrapper: React.FC<ChatPanelWrapperProps> = ({ spaceId }) => {
  const [mode, setMode] = useState<ChatMode>('llm');

  return (
    <>
      {/* Mode toggle button - positioned above the chat button */}
      <div className="fixed bottom-20 right-4 z-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('llm')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              mode === 'llm'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use LLM API (GPT/Claude)"
          >
            LLM API
          </button>
          <button
            onClick={() => setMode('claude-code')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              mode === 'claude-code'
                ? 'bg-purple-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use Claude Code (direct)"
          >
            Claude Code
          </button>
        </div>
      </div>

      {/* Render the appropriate chat panel based on mode */}
      {mode === 'llm' ? (
        <ChatPanel spaceId={spaceId} />
      ) : (
        <ChatPanelClaudeCode spaceId={spaceId} />
      )}
    </>
  );
};
