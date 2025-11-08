'use client';

import React from 'react';

interface ChatToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  variant?: 'blue' | 'purple';
  label?: string;
}

export const ChatToggleButton: React.FC<ChatToggleButtonProps> = ({
  isOpen,
  onClick,
  variant = 'blue',
  label = 'chat',
}) => {
  const bgColor = variant === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700';
  const title = isOpen ? `Close ${label}` : `Open ${label}`;

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-4 right-4 z-40 p-3 ${bgColor} text-white rounded-full shadow-lg transition-all`}
      title={title}
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
  );
};
