'use client';

import React, { useRef, useEffect } from 'react';
import { ChatMessage, Message } from '../ChatMessage';

interface ChatMessagesContainerProps {
  messages: Message[];
  isLoading?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  children?: React.ReactNode; // For additional content like change proposals
}

export const ChatMessagesContainer: React.FC<ChatMessagesContainerProps> = ({
  messages,
  isLoading = false,
  emptyStateTitle = 'Start a conversation!',
  emptyStateDescription = 'Ask me about cognitive modeling, your spaces, or anything else.',
  children,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
          <p className="text-sm">{emptyStateTitle}</p>
          <p className="text-xs mt-2">{emptyStateDescription}</p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}

      {children}

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
  );
};
