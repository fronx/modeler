'use client';

import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocketThoughts } from '../lib/websocket-thought-client';
import { useThoughtGraphState } from '../hooks/useThoughtGraphState';

// Custom node component for thoughts
const ThoughtNodeComponent: React.FC<{ data: any }> = ({ data }) => {
  const { node } = data;

  return (
    <div className="relative px-4 py-3 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      {/* Handles for edge connections on all sides */}
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="target" position={Position.Right} id="target-right" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Top} id="source-top" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      <Handle type="source" position={Position.Left} id="source-left" />

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

export const ThoughtGraph: React.FC = () => {
  const { nodes: thoughtNodes } = useWebSocketThoughts();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    hoveredNodeId,
    setHoveredNodeId,
  } = useThoughtGraphState(thoughtNodes);

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