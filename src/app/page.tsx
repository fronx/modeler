'use client';

import { useState } from 'react';
import { ThoughtGraph } from '@/components/ThoughtGraph';
import { SpaceSidebar } from '@/components/SpaceSidebar';
import { NewSpaceDialog } from '@/components/NewSpaceDialog';
import { InlineEdit } from '@/components/InlineEdit';
import { useWebSocketThoughts } from '@/lib/websocket-thought-client';

export default function CognitiveDashboard() {
  const { nodes, spaces, lastUpdate, currentSpaceId, setCurrentSpaceId, connectionStatus, hasLoadedCurrentSpace, deleteSpace, createSpace, updateSpaceTitle, updateSpaceDescription } = useWebSocketThoughts();
  const [showNewSpaceDialog, setShowNewSpaceDialog] = useState(false);

  // Get current space details
  const currentSpace = spaces.find(space => space.path === currentSpaceId);


  return (
    <div className="w-screen h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <SpaceSidebar
        spaces={spaces}
        currentSpaceId={currentSpaceId}
        onSpaceSelect={setCurrentSpaceId}
        onNewSpace={() => setShowNewSpaceDialog(true)}
        onSpaceDelete={deleteSpace}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentSpace ? (
                  <InlineEdit
                    value={currentSpace.title}
                    onSave={(newTitle) => updateSpaceTitle(currentSpace.id, newTitle)}
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                  />
                ) : (
                  'Cognitive Dashboard'
                )}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentSpace ? (
                  <InlineEdit
                    value={currentSpace.description}
                    onSave={(newDescription) => updateSpaceDescription(currentSpace.id, newDescription)}
                    className="text-sm text-gray-600 dark:text-gray-400"
                  />
                ) : (
                  'No space selected'
                )}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
                    connectionStatus === 'connecting' ? 'bg-yellow-500' :
                      connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {connectionStatus}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {nodes.size} thoughts {lastUpdate && `(last update: ${lastUpdate.toLocaleTimeString()})`}
              </div>
            </div>
          </div>
        </header>

        {/* Main visualization area */}
        <main className="flex-1 relative">
          {/* Content based on space state */}
          {!currentSpaceId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No space selected
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Select an existing space or create a new one to begin
                </p>
              </div>
            </div>
          ) : !hasLoadedCurrentSpace ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Loading space...
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Please wait while we load the thoughts for this space.
                </p>
              </div>
            </div>
          ) : nodes.size === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No thoughts in this space
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  This space is empty. Create thoughts using Claude Code to see them appear here in real-time.
                </p>
              </div>
            </div>
          ) : (
            <ThoughtGraph />
          )}
        </main>

        {/* Footer with legend */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>supports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>conflicts-with</span>
              </div>
            </div>
            <div className="text-right">
              <div>⚡ = tension • 🔀 = metaphor branches • Line thickness = relationship strength</div>
            </div>
          </div>
        </footer>
      </div>

      {/* New Space Dialog */}
      <NewSpaceDialog
        isOpen={showNewSpaceDialog}
        onClose={() => setShowNewSpaceDialog(false)}
        onCreateSpace={async (title, description) => {
          await createSpace(title, description);
        }}
      />
    </div>
  );
}
