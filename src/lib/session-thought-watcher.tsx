'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThoughtNode, type NodeId } from './thought-system';

interface ThoughtContextType {
  nodes: Map<string, ThoughtNode>;
  refreshTrigger: number;
  lastUpdate: Date | null;
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
}

const ThoughtContext = createContext<ThoughtContextType | undefined>(undefined);

interface ThoughtProviderProps {
  children: ReactNode;
}

export const SessionThoughtProvider: React.FC<ThoughtProviderProps> = ({ children }) => {
  const [nodes, setNodes] = useState<Map<string, ThoughtNode>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const loadThoughts = async (sessionId: string | null) => {
    if (!sessionId) {
      setNodes(new Map());
      setRefreshTrigger(prev => prev + 1);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/thoughts`);
      if (response.ok) {
        const data = await response.json();
        const nodeMap = new Map<string, ThoughtNode>();

        // Convert serialized data back to ThoughtNode instances
        for (const [id, nodeData] of Object.entries(data.nodes as any)) {
          const node = new ThoughtNode(id);
          node.meanings = nodeData.meanings || [];
          node.values = new Map(Object.entries(nodeData.values || {}));
          node.relationships = nodeData.relationships || [];
          node.metaphorBranches = nodeData.metaphorBranches || [];
          node.tension = nodeData.tension;
          node.history = nodeData.history || [];

          nodeMap.set(id, node);
        }

        setNodes(nodeMap);
        setLastUpdate(new Date());
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load session thoughts:', error);
    }
  };

  // Load default session on startup
  useEffect(() => {
    const loadDefaultSession = async () => {
      try {
        const response = await fetch('/api/sessions');
        if (response.ok) {
          const data = await response.json();
          if (data.sessions.length > 0) {
            // Load the most recent session
            const mostRecent = data.sessions[0];
            setCurrentSessionId(mostRecent.path);
          }
        }
      } catch (error) {
        console.error('Failed to load default session:', error);
      }
    };

    loadDefaultSession();
  }, []);

  // Load thoughts when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadThoughts(currentSessionId);

      // Poll for updates every 2 seconds
      const interval = setInterval(() => loadThoughts(currentSessionId), 2000);
      return () => clearInterval(interval);
    } else {
      setNodes(new Map());
    }
  }, [currentSessionId]);

  const value: ThoughtContextType = {
    nodes,
    refreshTrigger,
    lastUpdate,
    currentSessionId,
    setCurrentSessionId
  };

  return (
    <ThoughtContext.Provider value={value}>
      {children}
    </ThoughtContext.Provider>
  );
};

export const useSessionThoughts = (): ThoughtContextType => {
  const context = useContext(ThoughtContext);
  if (context === undefined) {
    throw new Error('useSessionThoughts must be used within a SessionThoughtProvider');
  }
  return context;
};