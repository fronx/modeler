'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocketThoughts } from '../lib/websocket-thought-client';
import { ThoughtNode } from '../lib/thought-system';

// Custom node component for thoughts
const ThoughtNodeComponent: React.FC<{ data: any }> = ({ data }) => {
  const { node } = data;

  return (
    <div className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="font-bold text-lg text-blue-600 dark:text-blue-400 mb-2">
        {node.id}
      </div>

      {/* Current meaning */}
      <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
        {node.currentMeaning()}
      </div>

      {/* Tension indicator */}
      {node.tension && (
        <div className="text-xs text-orange-600 dark:text-orange-400 italic mb-2">
          ⚡ {node.tension}
        </div>
      )}

      {/* Metaphor branches */}
      {node.metaphorBranches.length > 0 && (
        <div className="text-xs text-purple-600 dark:text-purple-400">
          🔀 {node.metaphorBranches.map((b: any) => b.name).join(', ')}
        </div>
      )}

      {/* Values */}
      {node.values.size > 0 && (
        <div className="text-xs text-green-600 dark:text-green-400 mt-1">
          {Array.from(node.values.entries()).map(([key, value]) => (
            <div key={key}>
              {key}: {JSON.stringify(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Node types
const nodeTypes = {
  thoughtNode: ThoughtNodeComponent,
};

// Helper function to get edge color based on relationship type
const getEdgeColor = (type: string): string => {
  const colors: Record<string, string> = {
    causes: '#ef4444', // red
    supports: '#22c55e', // green
    contradicts: '#f59e0b', // amber
    means: '#3b82f6', // blue
    becomes: '#8b5cf6', // violet
    observes: '#06b6d4', // cyan
    enables: '#10b981', // emerald
    'builds-on': '#6366f1', // indigo
    transcends: '#ec4899', // pink
    challenges: '#f97316', // orange
    implements: '#84cc16', // lime
    fulfills: '#14b8a6', // teal
    validates: '#a855f7', // purple
    'based-on': '#64748b', // slate
  };
  return colors[type] || '#6b7280';
};

export const ThoughtGraph: React.FC = () => {
  const { nodes: thoughtNodes } = useWebSocketThoughts();

  // Convert thought nodes to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Position nodes in a circle layout for better visualization
    const nodeArray = Array.from(thoughtNodes.values());
    const radius = Math.max(200, nodeArray.length * 50);

    nodeArray.forEach((thoughtNode: ThoughtNode, index: number) => {
      const angle = (index / nodeArray.length) * 2 * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      flowNodes.push({
        id: thoughtNode.id,
        type: 'thoughtNode',
        position: { x, y },
        data: { node: thoughtNode },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      // Create edges from relationships
      thoughtNode.relationships.forEach((rel, relIndex) => {
        flowEdges.push({
          id: `${thoughtNode.id}-${rel.target}-${relIndex}`,
          source: thoughtNode.id,
          target: rel.target,
          type: 'smoothstep',
          animated: rel.type === 'causes',
          label: `${rel.type} (${rel.strength})`,
          labelStyle: { fontSize: 10 },
          style: {
            stroke: getEdgeColor(rel.type),
            strokeWidth: Math.max(1, rel.strength * 3),
          },
          data: { relationship: rel },
        });
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [thoughtNodes]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update nodes and edges when thought space changes
  React.useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const onConnect = useCallback(() => {
    // Prevent manual connections for now
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.1 }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor="#3b82f6"
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};