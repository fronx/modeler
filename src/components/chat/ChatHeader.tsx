'use client';

import React from 'react';

type ChatMode = 'llm' | 'claude-code';

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  onClear?: () => void;
  onReset?: () => void;
  showClearButton?: boolean;
  isResetting?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  subtitle,
  onClear,
  onReset,
  showClearButton = false,
  isResetting = false,
  mode,
  onModeChange,
}) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Mode toggle - shown when mode switching is enabled */}
      {mode && onModeChange && (
        <div className="flex gap-1 p-2 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={() => onModeChange('llm')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              mode === 'llm'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use LLM API (GPT/Claude)"
          >
            LLM API
          </button>
          <button
            onClick={() => onModeChange('claude-code')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
              mode === 'claude-code'
                ? 'bg-purple-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use Claude Code (direct)"
          >
            Claude Code
          </button>
        </div>
      )}

      {/* Title and actions */}
      <div className="flex items-center justify-between p-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              disabled={isResetting}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              title="Reset session"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {showClearButton && onClear && (
            <button
              onClick={onClear}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Clear chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
