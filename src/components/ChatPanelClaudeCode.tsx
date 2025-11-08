'use client';

import React, { useState } from 'react';
import { Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatToggleButton } from './chat/ChatToggleButton';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessagesContainer } from './chat/ChatMessagesContainer';
import { SessionBrowser } from './SessionBrowser';

type ChatMode = 'llm' | 'claude-code';

interface ChatPanelClaudeCodeProps {
  spaceId?: string | null;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatPanelClaudeCode: React.FC<ChatPanelClaudeCodeProps> = ({ spaceId, mode, onModeChange, isOpen, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);

  const sendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build conversation history (limit to last 10 messages for context)
      const history = messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call Claude Code relay endpoint
      const response = await fetch('/api/claude-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: content,
          spaceId: spaceId || undefined,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message to Claude Code');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let toolUses: Array<{ id: string; name: string; input: any }> = [];
      let toolDenials: Array<{ tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> }> = [];

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        toolUses: [],
        toolDenials: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Handle text content
                if (parsed.content) {
                  assistantContent += parsed.content;
                  // Update the assistant message in place
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                      lastMsg.content = assistantContent;
                    }
                    return newMessages;
                  });
                }

                // Handle tool use
                if (parsed.type === 'tool_use' && parsed.tool_use) {
                  toolUses.push(parsed.tool_use);
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                      lastMsg.toolUses = [...toolUses];
                    }
                    return newMessages;
                  });
                }

                // Handle tool denials
                if (parsed.type === 'tool_denials' && parsed.denials) {
                  toolDenials.push(...parsed.denials);
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                      lastMsg.toolDenials = [...toolDenials];
                    }
                    return newMessages;
                  });
                }

                // Handle errors
                if (parsed.error) {
                  console.error('Claude Code error:', parsed.error);
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                      lastMsg.content += `\n\n**Error:** ${parsed.error}`;
                    }
                    return newMessages;
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error communicating with Claude Code. Please make sure Claude Code is installed and available in your PATH.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Clear all messages?')) {
      setMessages([]);
    }
  };

  const resetSession = async () => {
    if (!confirm('Reset Claude Code session? This will start a fresh conversation with /modeler loaded.')) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/claude-code/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (response.ok) {
        setMessages([]);
        const successMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: 'Session reset successfully. Claude Code is ready with /modeler context loaded.',
          timestamp: new Date(),
        };
        setMessages([successMessage]);
      } else {
        throw new Error('Failed to reset session');
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Failed to reset session: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsResetting(false);
    }
  };

  const resumeSession = async (sessionId: string) => {
    setIsResetting(true);
    try {
      const response = await fetch('/api/claude-code/sessions/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, spaceId }),
      });

      if (response.ok) {
        setMessages([]);
        const successMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `Resumed session ${sessionId.substring(0, 8)}. Continue your conversation from where you left off.`,
          timestamp: new Date(),
        };
        setMessages([successMessage]);
      } else {
        throw new Error('Failed to resume session');
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Failed to resume session: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <ChatToggleButton
        isOpen={isOpen}
        onClick={onToggle}
        variant="purple"
        label="Claude Code"
      />

      {/* Chat panel */}
      <div
        className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-300 z-30 flex flex-col ${
          isOpen ? 'w-96' : 'w-0'
        }`}
        style={{ overflow: isOpen ? 'visible' : 'hidden' }}
      >
        {isOpen && (
          <>
            <ChatHeader
              title="Claude Code"
              subtitle={spaceId ? 'Context: Current space • space-cli auto-approved' : 'space-cli auto-approved'}
              onClear={clearChat}
              onReset={resetSession}
              showClearButton={messages.length > 0}
              isResetting={isResetting}
              mode={mode}
              onModeChange={onModeChange}
            />

            {/* Resume Session Button */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowSessionBrowser(true)}
                className="w-full px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume Past Session
              </button>
            </div>

            <ChatMessagesContainer
              messages={messages}
              isLoading={isLoading}
              emptyStateTitle="Chat with Claude Code!"
              emptyStateDescription="This connects directly to your local Claude Code instance with full context of the space-cli."
            />

            <ChatInput
              onSendMessage={sendMessage}
              disabled={isLoading}
              placeholder="Ask Claude Code about your cognitive space..."
            />
          </>
        )}
      </div>

      {/* Session Browser Modal */}
      <SessionBrowser
        isOpen={showSessionBrowser}
        onClose={() => setShowSessionBrowser(false)}
        onResumeSession={resumeSession}
      />
    </>
  );
};
