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
  deleteSpace: (spaceId: string) => void;
  createSpace: (title?: string, description?: string) => Promise<Space>;
  updateSpaceTitle: (spaceId: string, newTitle: string) => Promise<void>;
}

const ThoughtContext = createContext<ThoughtContextType | undefined>(undefined);

interface ThoughtProviderProps {
  children: ReactNode;
}

export const WebSocketThoughtProvider: React.FC<ThoughtProviderProps> = ({ children }) => {
  const providerIdRef = useRef(Math.random().toString(36).substring(7));

  const [nodes, setNodes] = useState<Map<string, ThoughtNode>>(new Map());
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const currentSpaceIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentSpaceIdRef.current = currentSpaceId;
  }, [currentSpaceId]);
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

  const handleWebSocketMessage = useCallback((data: any) => {
    const currentSpace = currentSpaceIdRef.current;

    switch (data.type) {
      case 'spaces_update':
        setSpaces(data.spaces);
        setLastUpdate(new Date(data.timestamp));

        // Auto-select the most recent space if none is selected
        if (!currentSpace && data.spaces.length > 0) {
          const mostRecentSpace = data.spaces[0].path;
          handleSetCurrentSpaceId(mostRecentSpace);
        }
        break;

      case 'space_thoughts_update':
        // Only update if this is for the currently selected space
        if (data.spaceId === currentSpace) {
          // Use the same parsing logic as the API
          parseSpaceData(data, data.spaceId, data.timestamp);
        }
        break;

      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }, []);

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
      node.values.clear();
      for (const [key, value] of Object.entries(typedNodeData.values || {})) {
        node.values.set(key, value as any);
      }
      node.relationships = typedNodeData.relationships || [];
      node.metaphorBranches = typedNodeData.metaphorBranches || [];

      // Convert branches from object to Map
      node.branches = new Map();
      if (typedNodeData.branches) {
        for (const [branchName, branchData] of Object.entries(typedNodeData.branches)) {
          const branch = branchData as any;
          const branchValues = new Map();
          for (const [key, value] of Object.entries(branch.values || {})) {
            branchValues.set(key, value);
          }
          node.branches.set(branchName, {
            name: branch.name,
            interpretation: branch.interpretation,
            relationships: branch.relationships || [],
            values: branchValues,
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

    // Update nodes but try to preserve Map reference when possible
    setNodes(currentNodes => {
      // If we have no existing nodes, use the new map
      if (currentNodes.size === 0) {
        return nodeMap;
      }

      // If node count changed, definitely update
      if (currentNodes.size !== nodeMap.size) {
        return nodeMap;
      }

      // Check if we can reuse existing nodes by updating them in-place
      let hasChanges = false;
      const updatedNodes = new Map(currentNodes);

      for (const [id, newNode] of nodeMap) {
        const existingNode = updatedNodes.get(id);
        if (!existingNode) {
          // New node - add it
          updatedNodes.set(id, newNode);
          hasChanges = true;
        } else {
          // Update existing node's content but keep the same object if possible
          if (newNode.checkableList && existingNode.checkableList) {
            // Update checkbox states
            let checkboxChanged = false;
            for (let i = 0; i < newNode.checkableList.length; i++) {
              if (newNode.checkableList[i]?.checked !== existingNode.checkableList[i]?.checked) {
                existingNode.checkableList[i].checked = newNode.checkableList[i].checked;
                checkboxChanged = true;
              }
            }
            if (checkboxChanged) hasChanges = true;
          }
        }
      }

      return hasChanges ? updatedNodes : currentNodes;
    });

    setLoadedSpaceIds(prev => new Set(prev).add(spaceId));
    setLastUpdate(timestamp ? new Date(timestamp) : new Date());
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

  // Load space data when currentSpaceId changes
  useEffect(() => {
    if (currentSpaceId && nodes.size === 0) {
      loadSpaceFromAPI(currentSpaceId).catch(() => {
        // Fallback to WebSocket if API fails
      });
    }
  }, [currentSpaceId]);

  // Function to update nodes locally (for optimistic updates)
  const updateNode = useCallback((nodeId: string, updater: (node: ThoughtNode) => void) => {
    setNodes(currentNodes => {
      const node = currentNodes.get(nodeId);
      if (node) {
        updater(node);
        // Return the same Map reference since we're only modifying content
        // The Map itself doesn't change, only the internal properties of the nodes
        return currentNodes;
      }
      return currentNodes;
    });
  }, []);

  // Function to delete a space
  const deleteSpace = useCallback((spaceId: string) => {
    // Remove the space from the spaces list
    setSpaces(currentSpaces => currentSpaces.filter(space => space.id !== spaceId));

    // If the deleted space is currently selected, clear the selection
    if (currentSpaceId === spaceId) {
      setCurrentSpaceId(null);
      setNodes(new Map());
    }

    // Remove from loaded spaces
    setLoadedSpaceIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(spaceId);
      return newSet;
    });
  }, [currentSpaceId]);

  // Function to create a new space
  const createSpace = useCallback(async (title?: string, description?: string): Promise<Space> => {
    try {
      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title || 'New Space',
          description: description || 'A new cognitive modeling space'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create space: ${response.status}`);
      }

      const data = await response.json();
      const newSpace = data.space;

      // Add the new space to the spaces list
      setSpaces(currentSpaces => [newSpace, ...currentSpaces]);

      // Automatically select the new space
      handleSetCurrentSpaceId(newSpace.id);

      return newSpace;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  }, []);

  // Function to update space title
  const updateSpaceTitle = useCallback(async (spaceId: string, newTitle: string): Promise<void> => {
    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update space title: ${response.status}`);
      }

      // Update the local spaces list
      setSpaces(currentSpaces =>
        currentSpaces.map(space =>
          space.id === spaceId
            ? { ...space, title: newTitle, lastModified: new Date().toISOString() }
            : space
        )
      );
    } catch (error) {
      console.error('Error updating space title:', error);
      throw error;
    }
  }, []);

  const value: ThoughtContextType = {
    nodes,
    spaces,
    currentSpaceId,
    setCurrentSpaceId: handleSetCurrentSpaceId,
    lastUpdate,
    connectionStatus,
    hasLoadedCurrentSpace: currentSpaceId ? loadedSpaceIds.has(currentSpaceId) : false,
    updateNode,
    deleteSpace,
    createSpace,
    updateSpaceTitle
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