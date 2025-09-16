'use client';

import React, { useState } from 'react';

interface Space {
  id: string;
  title: string;
  description: string;
  created: string;
  lastModified: string;
  thoughtCount: number;
  path: string;
}

interface SpaceSidebarProps {
  spaces: Space[];
  currentSpaceId: string | null;
  onSpaceSelect: (spaceId: string) => void;
  onNewSpace: () => void;
}

export const SpaceSidebar: React.FC<SpaceSidebarProps> = ({
  spaces,
  currentSpaceId,
  onSpaceSelect,
  onNewSpace
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isLoading = spaces.length === 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return formatDate(dateStr);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Spaces
            </h2>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        {!isCollapsed && (
          <button
            onClick={onNewSpace}
            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            + New Space
          </button>
        )}
      </div>

      {/* Spaces List */}
      <div className="overflow-y-auto h-full">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {isCollapsed ? '...' : 'Loading spaces...'}
          </div>
        ) : spaces.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {isCollapsed ? '∅' : 'No spaces yet'}
          </div>
        ) : (
          <div className="p-2">
            {spaces.map((space) => (
              <div
                key={space.id}
                onClick={() => onSpaceSelect(space.path)}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                  currentSpaceId === space.path
                    ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {isCollapsed ? (
                  <div className="text-center">
                    <div className="text-2xl mb-1">🧠</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {space.thoughtCount}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                      {space.title}
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {space.description}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{space.thoughtCount} thoughts</span>
                      <span>{formatTimeAgo(space.lastModified)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {spaces.length} space{spaces.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};