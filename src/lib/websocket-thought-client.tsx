'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { ThoughtNode } from './thought-system';

interface Session {
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
  sessions: Session[];
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  lastUpdate: Date | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  hasLoadedCurrentSession: boolean;
}

const ThoughtContext = createContext<ThoughtContextType | undefined>(undefined);

interface ThoughtProviderProps {
  children: ReactNode;
}

export const WebSocketThoughtProvider: React.FC<ThoughtProviderProps> = ({ children }) => {
  const [nodes, setNodes] = useState<Map<string, ThoughtNode>>(new Map());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [loadedSessionIds, setLoadedSessionIds] = useState<Set<string>>(new Set());

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
        wsRef.current?.send(JSON.stringify({ type: 'get_sessions' }));

        // If we already have a session selected, request its data
        if (currentSessionId) {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe_session',
            sessionId: currentSessionId
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
      case 'sessions_update':
        setSessions(data.sessions);
        setLastUpdate(new Date(data.timestamp));

        // If no session is selected, select the most recent one
        if (!currentSessionId && data.sessions.length > 0) {
          const mostRecentSession = data.sessions[0].path;
          // Use the same logic as manual selection (will try API first, then WebSocket)
          handleSetCurrentSessionId(mostRecentSession);
        }
        break;

      case 'session_thoughts_update':
        // Use the same parsing logic as the API
        parseSessionData(data, data.sessionId, data.timestamp);
        break;

      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  };

  // Handle session changes
  const handleSetCurrentSessionId = (sessionId: string | null) => {
    setCurrentSessionId(sessionId);

    if (!sessionId) {
      setNodes(new Map());
      return;
    }

    // Clear current nodes and load session data
    setNodes(new Map());

    // Try loading from TypeScript-based API first
    loadSessionFromAPI(sessionId).catch(() => {
      // Fallback to WebSocket if API fails
      wsRef.current?.send(JSON.stringify({
        type: 'subscribe_session',
        sessionId
      }));
    });
  };

  // Shared function to parse session data (works with both API and WebSocket formats)
  const parseSessionData = (data: any, sessionId: string, timestamp?: string) => {
    // Handle both new Session structure and old format
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
      node.tension = typedNodeData.tension;
      node.history = typedNodeData.history || [];

      nodeMap.set(id, node);
    }

    setNodes(nodeMap);
    setLoadedSessionIds(prev => new Set(prev).add(sessionId));
    setLastUpdate(timestamp ? new Date(timestamp) : new Date());

    console.log(`✅ Loaded session data: ${nodeMap.size} thoughts`);
  };

  // Load session data from the new TypeScript-based API
  const loadSessionFromAPI = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/thoughts-direct`);
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }

      const data = await response.json();
      parseSessionData(data, sessionId);

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

  // Subscribe to session changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionId) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_session',
        sessionId: currentSessionId
      }));
    }
  }, [currentSessionId]);

  const value: ThoughtContextType = {
    nodes,
    sessions,
    currentSessionId,
    setCurrentSessionId: handleSetCurrentSessionId,
    lastUpdate,
    connectionStatus,
    hasLoadedCurrentSession: currentSessionId ? loadedSessionIds.has(currentSessionId) : false
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