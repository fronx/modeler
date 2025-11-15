'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { SpacesProvider, useSpaces } from '../state/spaces-context';
import { ThoughtsProvider, useThoughts } from '../state/thoughts-context';
import { ThoughtWebSocketClient, ConnectionStatus, WebSocketMessage } from '../websocket/websocket-client';

// Combined interface that exposes everything
interface CognitiveDataContextType {
  // Spaces
  spaces: ReturnType<typeof useSpaces>['spaces'];
  currentSpaceId: ReturnType<typeof useSpaces>['currentSpaceId'];
  setCurrentSpaceId: (spaceId: string | null) => void;
  createSpace: (title?: string, description?: string) => Promise<any>;
  updateSpaceTitle: ReturnType<typeof useSpaces>['updateSpaceTitle'];
  updateSpaceDescription: ReturnType<typeof useSpaces>['updateSpaceDescription'];
  deleteSpace: ReturnType<typeof useSpaces>['deleteSpace'];

  // Thoughts
  nodes: ReturnType<typeof useThoughts>['nodes'];
  lastUpdate: ReturnType<typeof useThoughts>['lastUpdate'];
  updateNode: ReturnType<typeof useThoughts>['updateNode'];
  deleteNode: (nodeId: string) => Promise<void>;  // Simplified - uses current space
  hasLoadedCurrentSpace: boolean;

  // WebSocket
  connectionStatus: ConnectionStatus;
}

const CognitiveDataContext = createContext<CognitiveDataContextType | undefined>(undefined);

// Inner component that has access to both contexts
const CognitiveDataProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const spacesContext = useSpaces();
  const thoughtsContext = useThoughts();
  const wsClient = useRef<ThoughtWebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatus>('disconnected');
  const currentSpaceIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentSpaceIdRef.current = spacesContext.currentSpaceId;
  }, [spacesContext.currentSpaceId]);

  // Initialize WebSocket client
  useEffect(() => {
    // Initialize WebSocket server by hitting the API endpoint
    fetch('/api/ws').catch(() => {
      console.log('WebSocket server initialization endpoint not available');
    });

    // Create WebSocket client
    wsClient.current = new ThoughtWebSocketClient();

    // Set up status monitoring
    const unsubscribeStatus = wsClient.current.onStatusChange(setConnectionStatus);

    // Set up message handling
    const unsubscribeMessages = wsClient.current.onMessage((message: WebSocketMessage) => {
      handleWebSocketMessage(message);
    });

    // Connect after a small delay
    const initTimeout = setTimeout(() => {
      wsClient.current?.connect();
    }, 1000);

    return () => {
      clearTimeout(initTimeout);
      unsubscribeStatus();
      unsubscribeMessages();
      wsClient.current?.disconnect();
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const currentSpace = currentSpaceIdRef.current;

    switch (message.type) {
      case 'spaces_update':
        // Only update spaces if WebSocket provides data (avoid clearing on empty messages)
        if (message.spaces && message.spaces.length > 0) {
          spacesContext.setSpaces(message.spaces);
          thoughtsContext.setLastUpdate(new Date(message.timestamp));

          // Auto-select the most recent space if none is selected
          if (!currentSpace && message.spaces.length > 0) {
            const mostRecentSpace = message.spaces[0].path;
            handleSetCurrentSpaceId(mostRecentSpace);
          }
        }
        break;

      case 'space_created':
        // A new space was just created - switch to it immediately
        if (message.spaceId) {
          handleSetCurrentSpaceId(message.spaceId);
        }
        break;

      case 'space_thoughts_update':
        // Only update if this is for the currently selected space
        if (message.spaceId === currentSpace) {
          thoughtsContext.updateNodesFromData(message, message.spaceId, message.timestamp);
        }
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }, []);

  // Enhanced space selection that manages thoughts loading
  const handleSetCurrentSpaceId = (spaceId: string | null) => {
    spacesContext.setCurrentSpaceId(spaceId);

    if (!spaceId) {
      thoughtsContext.clearNodes();
      return;
    }

    // Clear current nodes and load space data
    thoughtsContext.clearNodes();

    // Try loading from API first
    thoughtsContext.loadSpaceThoughts(spaceId).catch(() => {
      // Fallback to WebSocket if API fails
      wsClient.current?.subscribeToSpace(spaceId);
    });
  };

  // Load spaces initially via REST API (don't wait for WebSocket)
  useEffect(() => {
    const loadInitialSpaces = async () => {
      try {
        await spacesContext.refreshSpaces();
      } catch (error) {
        console.error('Failed to load initial spaces:', error);
      }
    };
    loadInitialSpaces();
  }, []);

  // Request spaces when connected (for live updates)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      wsClient.current?.requestSpaces();
    }
  }, [connectionStatus]);

  // Subscribe to space changes via WebSocket
  useEffect(() => {
    if (connectionStatus === 'connected' && spacesContext.currentSpaceId) {
      wsClient.current?.subscribeToSpace(spacesContext.currentSpaceId);
    }
  }, [connectionStatus, spacesContext.currentSpaceId]);

  // Load space data when currentSpaceId changes
  useEffect(() => {
    if (spacesContext.currentSpaceId && thoughtsContext.nodes.size === 0) {
      thoughtsContext.loadSpaceThoughts(spacesContext.currentSpaceId).catch(() => {
        // Fallback to WebSocket if API fails
      });
    }
  }, [spacesContext.currentSpaceId]);

  // Enhanced createSpace that auto-selects the new space
  const handleCreateSpace = useCallback(async (title?: string, description?: string) => {
    const newSpace = await spacesContext.createSpace({ title, description });
    // Auto-select the newly created space
    handleSetCurrentSpaceId(newSpace.id);
    return newSpace;
  }, [spacesContext.createSpace]);

  // Wrap deleteNode to use current space path
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    const currentSpaceId = spacesContext.currentSpaceId;
    if (!currentSpaceId) {
      throw new Error('No space selected');
    }

    await thoughtsContext.deleteNode(currentSpaceId, nodeId);
  }, [spacesContext.currentSpaceId, thoughtsContext.deleteNode]);

  const value: CognitiveDataContextType = {
    // Spaces
    spaces: spacesContext.spaces,
    currentSpaceId: spacesContext.currentSpaceId,
    setCurrentSpaceId: handleSetCurrentSpaceId,
    createSpace: handleCreateSpace,
    updateSpaceTitle: spacesContext.updateSpaceTitle,
    updateSpaceDescription: spacesContext.updateSpaceDescription,
    deleteSpace: spacesContext.deleteSpace,

    // Thoughts
    nodes: thoughtsContext.nodes,
    lastUpdate: thoughtsContext.lastUpdate,
    updateNode: thoughtsContext.updateNode,
    deleteNode: handleDeleteNode,
    hasLoadedCurrentSpace: spacesContext.currentSpaceId ? thoughtsContext.hasLoadedSpace(spacesContext.currentSpaceId) : false,

    // WebSocket
    connectionStatus,
  };

  return (
    <CognitiveDataContext.Provider value={value}>
      {children}
    </CognitiveDataContext.Provider>
  );
};

// Main provider that wraps everything
export const CognitiveDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SpacesProvider>
      <ThoughtsProvider>
        <CognitiveDataProviderInner>
          {children}
        </CognitiveDataProviderInner>
      </ThoughtsProvider>
    </SpacesProvider>
  );
};

export const useCognitiveData = (): CognitiveDataContextType => {
  const context = useContext(CognitiveDataContext);
  if (context === undefined) {
    throw new Error('useCognitiveData must be used within a CognitiveDataProvider');
  }
  return context;
};