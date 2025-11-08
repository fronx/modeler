'use client';

import React, { useState, useEffect } from 'react';
import { Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChangeProposal } from './ChangeProposal';
import { ChatToggleButton } from './chat/ChatToggleButton';
import { ChatHeader } from './chat/ChatHeader';
import { ChatMessagesContainer } from './chat/ChatMessagesContainer';

type ChatMode = 'llm' | 'claude-code';

interface ChatPanelProps {
  spaceId?: string | null;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface ProposedChange {
  function: string;
  arguments: Record<string, any>;
  spaceId: string;
}

interface BatchProposedChanges {
  changes: ProposedChange[];
  spaceId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ spaceId, mode, onModeChange, isOpen, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<ProposedChange[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Check API configuration on mount
  useEffect(() => {
    fetch('/api/chat')
      .then((res) => res.json())
      .then((data) => {
        setIsConfigured(data.status === 'ready');
      })
      .catch(() => {
        setIsConfigured(false);
      });
  }, []);


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

      // Always use streaming (now supports tool calls)
      const response = await fetch('/api/chat', {
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
        throw new Error('Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
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

                // Handle proposed changes (tool calls)
                if (parsed.proposedChange) {
                  setPendingChanges((prev) => [...prev, parsed.proposedChange]);
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
        content: 'Sorry, I encountered an error. Please try again.',
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
      setPendingChanges([]);
    }
  };

  const handleApproveChange = async () => {
    if (pendingChanges.length === 0) return;

    setIsExecuting(true);
    try {
      const response = await fetch('/api/chat/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes: pendingChanges,
          spaceId: spaceId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add success message
        const successMessage: Message = {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Changes executed successfully!**\n\n${data.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);
        setPendingChanges([]);
      } else {
        throw new Error(data.error || 'Failed to execute changes');
      }
    } catch (error: any) {
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Failed to execute changes:**\n\n${error.message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRejectChange = () => {
    setPendingChanges([]);
    // Add rejection message
    const rejectMessage: Message = {
      id: `system-${Date.now()}`,
      role: 'assistant',
      content: 'Change proposals rejected. How else can I help?',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, rejectMessage]);
  };

  return (
    <>
      <ChatToggleButton
        isOpen={isOpen}
        onClick={onToggle}
        variant="blue"
        label="AI Assistant"
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
              title="AI Assistant"
              subtitle={spaceId ? 'Context: Current space' : undefined}
              onClear={clearChat}
              showClearButton={messages.length > 0}
              mode={mode}
              onModeChange={onModeChange}
            />

            {!isConfigured && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 m-4 mb-0">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  <strong>API Not Configured</strong>
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Set <code>OPENAI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> in your environment to enable chat.
                </p>
              </div>
            )}

            <ChatMessagesContainer
              messages={messages}
              isLoading={isLoading}
              emptyStateTitle={isConfigured ? 'Start a conversation!' : ''}
              emptyStateDescription={isConfigured ? 'Ask me about cognitive modeling, your spaces, or anything else.' : ''}
            >
              {pendingChanges.length > 0 && (
                <div className="border-2 border-blue-500 dark:border-blue-400 rounded-lg p-3 mb-4 bg-blue-50 dark:bg-blue-900/20">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="text-blue-600 dark:text-blue-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Proposed Changes ({pendingChanges.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingChanges.map((change, idx) => (
                          <ChangeProposal
                            key={idx}
                            proposal={change}
                            onApprove={() => {}}
                            onReject={() => {}}
                            isExecuting={false}
                            hideButtons={true}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleRejectChange}
                      disabled={isExecuting}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                      Reject All
                    </button>
                    <button
                      onClick={handleApproveChange}
                      disabled={isExecuting}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? 'Executing...' : `Approve & Execute All (${pendingChanges.length})`}
                    </button>
                  </div>
                </div>
              )}
            </ChatMessagesContainer>

            <ChatInput
              onSendMessage={sendMessage}
              disabled={isLoading || !isConfigured}
              placeholder={
                isConfigured
                  ? 'Ask about your cognitive space...'
                  : 'Configure API key to enable chat'
              }
            />
          </>
        )}
      </div>
    </>
  );
};
