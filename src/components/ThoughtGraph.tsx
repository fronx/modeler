'use client';

import React, { useCallback, useState } from 'react';
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
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocketThoughts } from '../lib/websocket-thought-client';
import { ThoughtNode } from '../lib/thought-system';

// Custom node component for thoughts
const ThoughtNodeComponent: React.FC<{ data: any }> = ({ data }) => {
  const { node } = data;

  return (
    <div className="relative px-4 py-3 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      {/* Handles for edge connections */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);


  // Convert thought nodes to React Flow nodes and edges directly (like the working minimal test)
  const { flowNodes, allEdges } = React.useMemo(() => {
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
        draggable: true,
      });

      // Create edges from relationships
      thoughtNode.relationships.forEach((rel, relIndex) => {
        // Only create edge if target node exists
        if (nodeArray.some(n => n.id === rel.target)) {
          const edge = {
            id: `${thoughtNode.id}-${rel.target}-${relIndex}`,
            source: thoughtNode.id,
            target: rel.target,
            type: 'straight',
            animated: rel.type === 'causes',
            label: `${rel.type} (${rel.strength})`,
            labelStyle: { fontSize: 12, fill: '#000', fontWeight: 'bold' },
            style: {
              stroke: getEdgeColor(rel.type),
              strokeWidth: 3,
              strokeDasharray: rel.type === 'causes' ? '5,5' : undefined,
            },
            data: { relationship: rel },
          };
          flowEdges.push(edge);
        }
      });
    });


    return { flowNodes, allEdges: flowEdges };
  }, [thoughtNodes]);

  // Filter edges to only show those connected to hovered node
  const visibleEdges = React.useMemo(() => {
    if (!hoveredNodeId) return [];
    return allEdges.filter(edge =>
      edge.source === hoveredNodeId || edge.target === hoveredNodeId
    );
  }, [allEdges, hoveredNodeId]);

  // Use nodes state to enable dragging
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Update nodes when thoughtNodes change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  // Update edges when visibleEdges change
  React.useEffect(() => {
    setEdges(visibleEdges);
  }, [visibleEdges, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        nodeTypes={nodeTypes}
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