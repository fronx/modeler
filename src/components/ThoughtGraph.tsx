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

// Custom node component for thoughts with semantic zooming
const ThoughtNodeComponent: React.FC<{ data: any }> = ({ data }) => {
  const { node, color } = data;
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Calculate detail level based on focus (0.0 to 1.0)
  const focusLevel = node.focus || 0.1;
  const naturalShowFullDetail = focusLevel >= 0.7;
  const naturalShowPartialDetail = focusLevel >= 0.4;

  // Override natural detail level if manually expanded
  const showFullDetail = isExpanded || naturalShowFullDetail;
  const showPartialDetail = isExpanded || naturalShowPartialDetail;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className="relative px-4 py-3 bg-white dark:bg-gray-800 border-2 rounded-lg shadow-lg min-w-[200px] max-w-[300px] cursor-pointer transition-colors hover:opacity-80"
      style={{
        borderColor: color
      }}
      onClick={handleClick}
    >
      {/* Handles for edge connections on all sides */}
      <Handle type="target" position={Position.Top} id="target-top" />
      <Handle type="target" position={Position.Right} id="target-right" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" />
      <Handle type="target" position={Position.Left} id="target-left" />
      <Handle type="source" position={Position.Top} id="source-top" />
      <Handle type="source" position={Position.Right} id="source-right" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" />
      <Handle type="source" position={Position.Left} id="source-left" />

      {/* Title - always visible */}
      <div className="font-bold text-lg mb-2 flex items-center justify-between" style={{ color }}>
        <span>{node.id}</span>
        {!naturalShowFullDetail && (
          <span className="text-xs text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {/* Current meaning - only at partial detail and above */}
      {showPartialDetail && (
        <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          {showFullDetail ? node.currentMeaning() :
           `${node.currentMeaning().substring(0, 60)}${node.currentMeaning().length > 60 ? '...' : ''}`}
        </div>
      )}

      {/* Full details - only at high focus */}
      {showFullDetail && (
        <>
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
        </>
      )}
    </div>
  );
};

// Node types
const nodeTypes = {
  thoughtNode: ThoughtNodeComponent,
};

interface ThoughtGraphProps {
  backgroundEdgeOpacity?: number;
  showArrows?: boolean;
}

export const ThoughtGraph: React.FC<ThoughtGraphProps> = ({
  backgroundEdgeOpacity = 0.2,
  showArrows = false
}) => {
  const { nodes: thoughtNodes } = useWebSocketThoughts();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    hoveredNodeId,
    setHoveredNodeId,
  } = useThoughtGraphState(thoughtNodes, backgroundEdgeOpacity, showArrows);

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
          nodeColor={(node) => node.data?.color || '#6b7280'}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};