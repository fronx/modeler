'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Message } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChangeProposal } from './ChangeProposal';

interface ChatPanelProps {
  spaceId?: string | null;
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

export const ChatPanel: React.FC<ChatPanelProps> = ({ spaceId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<ProposedChange[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      {/* Toggle button - fixed position */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all"
        title={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-300 z-30 flex flex-col ${
          isOpen ? 'w-96' : 'w-0'
        }`}
        style={{ overflow: isOpen ? 'visible' : 'hidden' }}
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  AI Assistant
                </h2>
                {spaceId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Context: Current space
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
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

            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4"
            >
              {!isConfigured && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    <strong>API Not Configured</strong>
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Set <code>OPENAI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> in your environment to enable chat.
                  </p>
                </div>
              )}

              {messages.length === 0 && isConfigured && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  <p className="text-sm">Start a conversation!</p>
                  <p className="text-xs mt-2">Ask me about cognitive modeling, your spaces, or anything else.</p>
                </div>
              )}

              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

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

              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
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
