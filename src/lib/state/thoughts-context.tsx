'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ThoughtNode } from '../thought-system';
import { thoughtsApi } from '../data/thoughts-api';

interface ThoughtsContextType {
  nodes: Map<string, ThoughtNode>;
  loadedSpaceIds: Set<string>;
  lastUpdate: Date | null;
  setNodes: (nodes: Map<string, ThoughtNode>) => void;
  setLastUpdate: (date: Date | null) => void;
  updateNode: (nodeId: string, updater: (node: ThoughtNode) => void) => void;
  deleteNode: (spaceId: string, nodeId: string) => Promise<void>;
  loadSpaceThoughts: (spaceId: string) => Promise<void>;
  updateNodesFromData: (data: any, spaceId: string, timestamp?: string) => void;
  hasLoadedSpace: (spaceId: string) => boolean;
  clearNodes: () => void;
}

const ThoughtsContext = createContext<ThoughtsContextType | undefined>(undefined);

interface ThoughtsProviderProps {
  children: ReactNode;
}

export const ThoughtsProvider: React.FC<ThoughtsProviderProps> = ({ children }) => {
  const [nodes, setNodes] = useState<Map<string, ThoughtNode>>(new Map());
  const [loadedSpaceIds, setLoadedSpaceIds] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const clearNodes = useCallback(() => {
    setNodes(new Map());
  }, []);

  const loadSpaceThoughts = useCallback(async (spaceId: string): Promise<void> => {
    try {
      const data = await thoughtsApi.getSpaceThoughts(spaceId);
      const nodeMap = thoughtsApi.parseThoughtData(data);
      setNodes(nodeMap);
      setLoadedSpaceIds(prev => new Set(prev).add(spaceId));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load space thoughts:', error);
      throw error;
    }
  }, []);

  const updateNodesFromData = useCallback((data: any, spaceId: string, timestamp?: string) => {
    const nodeMap = thoughtsApi.parseThoughtData(data);

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
            // If list lengths differ, replace the entire list
            if (newNode.checkableList.length !== existingNode.checkableList.length) {
              existingNode.checkableList = [...newNode.checkableList];
              hasChanges = true;
            } else {
              // Update checkbox states in place
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
      }

      return hasChanges ? updatedNodes : currentNodes;
    });

    setLoadedSpaceIds(prev => new Set(prev).add(spaceId));
    setLastUpdate(timestamp ? new Date(timestamp) : new Date());
  }, []);

  const updateNode = useCallback((nodeId: string, updater: (node: ThoughtNode) => void) => {
    setNodes(currentNodes => {
      const node = currentNodes.get(nodeId);
      if (node) {
        updater(node);
        // Return the same Map reference since we're only modifying content
        return currentNodes;
      }
      return currentNodes;
    });
  }, []);

  const deleteNode = useCallback(async (spaceId: string, nodeId: string): Promise<void> => {
    console.log(`[deleteNode] Attempting to delete node: ${nodeId} from space: ${spaceId}`);

    // Optimistic update - remove from UI immediately
    let removedNode: ThoughtNode | undefined;
    setNodes(currentNodes => {
      const newNodes = new Map(currentNodes);
      removedNode = newNodes.get(nodeId);
      newNodes.delete(nodeId);
      console.log(`[deleteNode] Optimistically removed from local state`);
      return newNodes;
    });

    try {
      const response = await fetch(`/api/spaces/${spaceId}/thoughts/${nodeId}`, {
        method: 'DELETE',
      });

      console.log(`[deleteNode] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[deleteNode] API error:`, errorText);
        throw new Error(`Failed to delete node: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[deleteNode] API success:`, result);
    } catch (error) {
      console.error('[deleteNode] Error:', error);

      // Rollback optimistic update on error
      if (removedNode) {
        setNodes(currentNodes => {
          const newNodes = new Map(currentNodes);
          newNodes.set(nodeId, removedNode);
          console.log(`[deleteNode] Rolled back deletion due to error`);
          return newNodes;
        });
      }

      throw error;
    }
  }, []);

  const hasLoadedSpace = useCallback((spaceId: string): boolean => {
    return loadedSpaceIds.has(spaceId);
  }, [loadedSpaceIds]);

  const value: ThoughtsContextType = {
    nodes,
    loadedSpaceIds,
    lastUpdate,
    setNodes,
    setLastUpdate,
    updateNode,
    deleteNode,
    loadSpaceThoughts,
    updateNodesFromData,
    hasLoadedSpace,
    clearNodes,
  };

  return (
    <ThoughtsContext.Provider value={value}>
      {children}
    </ThoughtsContext.Provider>
  );
};

export const useThoughts = (): ThoughtsContextType => {
  const context = useContext(ThoughtsContext);
  if (context === undefined) {
    throw new Error('useThoughts must be used within a ThoughtsProvider');
  }
  return context;
};