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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {mode === 'llm' ? (
        <ChatPanel
          spaceId={spaceId}
          mode={mode}
          onModeChange={setMode}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
        />
      ) : (
        <ChatPanelClaudeCode
          spaceId={spaceId}
          mode={mode}
          onModeChange={setMode}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
        />
      )}
    </>
  );
};
