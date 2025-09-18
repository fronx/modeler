'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { ThoughtNode } from './thought-system';

interface Space {
  id: string;
  title: string;
  description: string;
  created: string;
  lastModified: string;
  thoughtCount: number;
  path: string;
}

interface ThoughtContextType {
  nodes: Map<string, ThoughtNode>;
  spaces: Space[];
  currentSpaceId: string | null;
  setCurrentSpaceId: (spaceId: string | null) => void;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  hasLoadedCurrentSpace: boolean;
  updateNode: (nodeId: string, updater: (node: ThoughtNode) => void) => void;
}

const ThoughtContext = createContext<ThoughtContextType | undefined>(undefined);

interface ThoughtProviderProps {
  children: ReactNode;
}

export const WebSocketThoughtProvider: React.FC<ThoughtProviderProps> = ({ children }) => {
  const [nodes, setNodes] = useState<Map<string, ThoughtNode>>(new Map());
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [loadedSpaceIds, setLoadedSpaceIds] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionStatus('connecting');

    try {
      wsRef.current = new WebSocket('ws://localhost:8080');

      wsRef.current.onopen = () => {
        console.log('🔗 Connected to ThoughtWebSocket');
        setConnectionStatus('connected');

        // Request initial data
        wsRef.current?.send(JSON.stringify({ type: 'get_spaces' }));

        // If we already have a space selected, request its data
        if (currentSpaceId) {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe_space',
            spaceId: currentSpaceId
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('🔌 Disconnected from ThoughtWebSocket');
        setConnectionStatus('disconnected');

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'spaces_update':
        setSpaces(data.spaces);
        setLastUpdate(new Date(data.timestamp));

        // If no space is selected, select the most recent one
        if (!currentSpaceId && data.spaces.length > 0) {
          const mostRecentSpace = data.spaces[0].path;
          // Use the same logic as manual selection (will try API first, then WebSocket)
          handleSetCurrentSpaceId(mostRecentSpace);
        }
        break;

      case 'space_thoughts_update':
        // Use the same parsing logic as the API
        parseSpaceData(data, data.spaceId, data.timestamp);
        break;

      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  };

  // Handle space changes
  const handleSetCurrentSpaceId = (spaceId: string | null) => {
    setCurrentSpaceId(spaceId);

    if (!spaceId) {
      setNodes(new Map());
      return;
    }

    // Clear current nodes and load space data
    setNodes(new Map());

    // Try loading from TypeScript-based API first
    loadSpaceFromAPI(spaceId).catch(() => {
      // Fallback to WebSocket if API fails
      wsRef.current?.send(JSON.stringify({
        type: 'subscribe_space',
        spaceId
      }));
    });
  };

  // Shared function to parse space data (works with both API and WebSocket formats)
  const parseSpaceData = (data: any, spaceId: string, timestamp?: string) => {
    // Handle both new Space structure and old format
    const thoughtSpaceData = data.thoughtSpace || data; // New format has thoughtSpace, old format is flat
    const nodesData = thoughtSpaceData.nodes || data.nodes || {}; // Support both structures

    const nodeMap = new Map<string, ThoughtNode>();

    // Convert serialized data back to ThoughtNode instances
    for (const [id, nodeData] of Object.entries(nodesData)) {
      const node = new ThoughtNode(id);
      const typedNodeData = nodeData as any;
      node.meanings = typedNodeData.meanings || [];
      node.values = new Map(Object.entries(typedNodeData.values || {}));
      node.relationships = typedNodeData.relationships || [];
      node.metaphorBranches = typedNodeData.metaphorBranches || [];

      // Convert branches from object to Map
      node.branches = new Map();
      if (typedNodeData.branches) {
        for (const [branchName, branchData] of Object.entries(typedNodeData.branches)) {
          const branch = branchData as any;
          node.branches.set(branchName, {
            name: branch.name,
            interpretation: branch.interpretation,
            relationships: branch.relationships || [],
            values: new Map(Object.entries(branch.values || {})),
            isActive: branch.isActive !== undefined ? branch.isActive : true
          });
        }
      }

      node.resolutions = typedNodeData.resolutions || [];
      node.tension = typedNodeData.tension;
      node.focus = typedNodeData.focus || 0.1; // Default to background if not specified
      node.semanticPosition = typedNodeData.semanticPosition || 0.0; // Default to center/neutral
      node.history = typedNodeData.history || [];

      // List properties - handle both old and new formats
      if (typedNodeData.regularList) {
        if (Array.isArray(typedNodeData.regularList)) {
          // Simple array format
          node.regularList = typedNodeData.regularList;
        } else if (typeof typedNodeData.regularList === 'object' && typedNodeData.regularList.items) {
          // Legacy {name, items} format - extract just the items
          node.regularList = typedNodeData.regularList.items;
        }
      }

      if (typedNodeData.checkableList) {
        if (Array.isArray(typedNodeData.checkableList)) {
          // Simple array format
          node.checkableList = typedNodeData.checkableList;
        } else if (typeof typedNodeData.checkableList === 'object' && typedNodeData.checkableList.items) {
          // Legacy {name, items} format - extract just the items
          node.checkableList = typedNodeData.checkableList.items;
        }
      }

      nodeMap.set(id, node);
    }

    setNodes(nodeMap);
    setLoadedSpaceIds(prev => new Set(prev).add(spaceId));
    setLastUpdate(timestamp ? new Date(timestamp) : new Date());

    console.log(`✅ Loaded space data: ${nodeMap.size} thoughts`);
  };

  // Load space data from the new TypeScript-based API
  const loadSpaceFromAPI = async (spaceId: string) => {
    try {
      const response = await fetch(`/api/spaces/${spaceId}/thoughts-direct`);
      if (!response.ok) {
        throw new Error(`Failed to load space: ${response.status}`);
      }

      const data = await response.json();
      parseSpaceData(data, spaceId);

    } catch (error) {
      console.warn('Failed to load from TypeScript API, will try WebSocket:', error);
      throw error;
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    // Initialize WebSocket server by hitting the API endpoint
    fetch('/api/ws').catch(() => {
      console.log('WebSocket server initialization endpoint not available');
    });

    // Small delay to let server start, then connect
    const initTimeout = setTimeout(() => {
      connectWebSocket();
    }, 1000);

    return () => {
      clearTimeout(initTimeout);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Subscribe to space changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentSpaceId) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_space',
        spaceId: currentSpaceId
      }));
    }
  }, [currentSpaceId]);

  // Function to update nodes locally (for optimistic updates)
  const updateNode = useCallback((nodeId: string, updater: (node: ThoughtNode) => void) => {
    setNodes(currentNodes => {
      const updatedNodes = new Map(currentNodes);
      const node = updatedNodes.get(nodeId);
      if (node) {
        updater(node);
      }
      return updatedNodes;
    });
  }, []);

  const value: ThoughtContextType = {
    nodes,
    spaces,
    currentSpaceId,
    setCurrentSpaceId: handleSetCurrentSpaceId,
    lastUpdate,
    connectionStatus,
    hasLoadedCurrentSpace: currentSpaceId ? loadedSpaceIds.has(currentSpaceId) : false,
    updateNode
  };

  return (
    <ThoughtContext.Provider value={value}>
      {children}
    </ThoughtContext.Provider>
  );
};

export const useWebSocketThoughts = (): ThoughtContextType => {
  const context = useContext(ThoughtContext);
  if (context === undefined) {
    throw new Error('useWebSocketThoughts must be used within a WebSocketThoughtProvider');
  }
  return context;
};