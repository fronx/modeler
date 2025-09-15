'use client';

import { ThoughtGraph } from '@/components/ThoughtGraph';
import { SessionSidebar } from '@/components/SessionSidebar';
import { useSessionThoughts } from '@/lib/session-thought-watcher';

export default function CognitiveDashboard() {
  const { nodes, lastUpdate, currentSessionId, setCurrentSessionId } = useSessionThoughts();

  const handleCreateExampleThoughts = async () => {
    // This would typically be done via Claude Code creating thoughts
    // For now, show instructions
    if (currentSessionId) {
      alert(`Create thoughts by running: npx tsx create-session-thoughts.ts ${currentSessionId}`);
    } else {
      alert('Please select or create a session first');
    }
  };

  return (
    <div className="w-screen h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <SessionSidebar
        currentSessionId={currentSessionId}
        onSessionSelect={setCurrentSessionId}
        onNewSession={() => {
          // The sidebar handles session creation
        }}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Cognitive Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentSessionId ? `Session: ${currentSessionId}` : 'No session selected'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {nodes.size} thoughts {lastUpdate && `(last update: ${lastUpdate.toLocaleTimeString()})`}
              </div>
              <button
                onClick={handleCreateExampleThoughts}
                disabled={!currentSessionId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Example Thoughts
              </button>
            </div>
          </div>
        </header>

        {/* Main visualization area */}
        <main className="flex-1 relative">
          {/* Content based on session state */}
          {!currentSessionId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No session selected
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Select an existing session or create a new one to begin
                </p>
              </div>
            </div>
          ) : nodes.size === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No thoughts in this session
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Create your first thought to see the visualization come alive
                </p>
                <button
                  onClick={handleCreateExampleThoughts}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Example Thoughts
                </button>
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
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>causes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>supports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>means</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-violet-500 rounded"></div>
                <span>becomes</span>
              </div>
            </div>
            <div className="text-right">
              <div>⚡ = tension • 🔀 = metaphor branches • Line thickness = relationship strength</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
