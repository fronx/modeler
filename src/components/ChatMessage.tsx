'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}
      >
        <div className="text-sm break-words prose prose-sm dark:prose-invert max-w-none">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Customize link styling
                a: ({ node, ...props }) => (
                  <a {...props} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" />
                ),
                // Customize code block styling
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code {...props} className="bg-gray-800 dark:bg-gray-600 px-1 py-0.5 rounded text-xs" />
                  ) : (
                    <code {...props} className="block bg-gray-800 dark:bg-gray-600 p-2 rounded text-xs overflow-x-auto" />
                  ),
                // Customize list styling
                ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside space-y-1" />,
                ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside space-y-1" />,
                // Customize heading styling
                h1: ({ node, ...props }) => <h1 {...props} className="text-lg font-bold mt-2 mb-1" />,
                h2: ({ node, ...props }) => <h2 {...props} className="text-base font-bold mt-2 mb-1" />,
                h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-bold mt-1 mb-1" />,
                // Customize paragraph spacing
                p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};
