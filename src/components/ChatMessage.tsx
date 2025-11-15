'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ToolUse {
  id: string;
  name: string;
  input: any;
}

export interface ToolDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
}

// Content blocks that can be interleaved
export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; toolUse: ToolUse }
  | { type: 'tool_denial'; denial: ToolDenial };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // New field for interleaved content
  contentBlocks?: ContentBlock[];
  // Keep for backwards compatibility
  toolUses?: ToolUse[];
  toolDenials?: ToolDenial[];
  // Flag for system/automated messages
  isSystem?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

const ToolUseDisplay: React.FC<{ toolUse: ToolUse }> = ({ toolUse }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mt-2 border-l-2 border-purple-500 pl-3 text-xs">
      <div
        className="font-mono text-purple-600 dark:text-purple-400 cursor-pointer hover:text-purple-700 dark:hover:text-purple-300"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '▼' : '▶'} Tool: {toolUse.name}
      </div>
      {isExpanded && (
        <pre className="mt-1 bg-gray-800 dark:bg-gray-900 text-gray-200 p-2 rounded text-xs overflow-x-auto">
          {JSON.stringify(toolUse.input, null, 2)}
        </pre>
      )}
    </div>
  );
};

const ToolDenialDisplay: React.FC<{ denial: { tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> } }> = ({ denial }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="mt-2 border-l-2 border-red-500 pl-3 text-xs">
      <div
        className="font-mono text-red-600 dark:text-red-400 cursor-pointer hover:text-red-700 dark:hover:text-red-300"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '▼' : '▶'} Denied: {denial.tool_name}
      </div>
      {isExpanded && (
        <pre className="mt-1 bg-gray-800 dark:bg-gray-900 text-gray-200 p-2 rounded text-xs overflow-x-auto">
          {JSON.stringify(denial.tool_input, null, 2)}
        </pre>
      )}
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  // Render content blocks in order if available, otherwise fall back to old format
  const renderContent = () => {
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      return (
        <>
          {message.contentBlocks.map((block, index) => {
            switch (block.type) {
              case 'text':
                return (
                  <ReactMarkdown
                    key={`text-${index}`}
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
                    {block.content}
                  </ReactMarkdown>
                );
              case 'tool_use':
                return <ToolUseDisplay key={`tool-${block.toolUse.id}`} toolUse={block.toolUse} />;
              case 'tool_denial':
                return <ToolDenialDisplay key={`denial-${block.denial.tool_use_id}`} denial={block.denial} />;
              default:
                return null;
            }
          })}
        </>
      );
    }

    // Fall back to old format for backwards compatibility
    return (
      <>
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

        {/* Display tool uses */}
        {message.toolUses && message.toolUses.length > 0 && (
          <div className="mt-3 space-y-1">
            {message.toolUses.map((toolUse) => (
              <ToolUseDisplay key={toolUse.id} toolUse={toolUse} />
            ))}
          </div>
        )}

        {/* Display tool denials */}
        {message.toolDenials && message.toolDenials.length > 0 && (
          <div className="mt-3 space-y-1">
            {message.toolDenials.map((denial) => (
              <ToolDenialDisplay key={denial.tool_use_id} denial={denial} />
            ))}
          </div>
        )}
      </>
    );
  };

  // System messages get special styling (centered, subtle)
  if (message.isSystem) {
    return (
      <div className="flex justify-center mb-4">
        <div className="max-w-[80%] px-4 py-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

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
          {isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : renderContent()}
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
