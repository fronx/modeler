'use client';

import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  Handle,
  SelectionMode,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocketThoughts } from '../lib/websocket-thought-client';
import { useThoughtGraphState } from '../hooks/useThoughtGraphState';

// Custom node component for thoughts with semantic zooming
const ThoughtNodeComponent: React.FC<{ data: any, selected?: boolean }> = ({ data, selected }) => {
  const { node, color } = data;
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Calculate detail level based on focus (three-state system)
  const focusLevel = node.focus;
  const isHighlighted = focusLevel === 1.0;
  const isDiscarded = focusLevel === -1.0;
  const isNeutral = focusLevel === undefined || focusLevel === null;

  // Highlighted nodes show full detail, neutral nodes show partial, discarded show minimal
  const naturalShowFullDetail = isHighlighted;
  const naturalShowPartialDetail = isHighlighted || isNeutral;

  // Override natural detail level if manually expanded
  const showFullDetail = isExpanded || naturalShowFullDetail;
  const showPartialDetail = isExpanded || naturalShowPartialDetail;

  const handleClick = (e: React.MouseEvent) => {
    // Don't stop propagation if Meta/Cmd key is held (for multi-selection)
    if (!e.metaKey && !e.ctrlKey) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
    // If Meta/Cmd is held, let React Flow handle the selection
  };

  return (
    <div
      className={`relative px-4 py-3 bg-white dark:bg-gray-800 border-2 rounded-lg shadow-lg min-w-[200px] max-w-[300px] cursor-pointer transition-all duration-300 hover:opacity-80 ${
        isDiscarded ? 'opacity-40 saturate-50' :
        selected ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 shadow-2xl bg-purple-50 dark:bg-purple-900/30 scale-105' :
        isHighlighted ? 'ring-2 ring-blue-400 shadow-xl' : ''
      }`}
      style={{
        borderColor: color,
        borderWidth: selected ? '3px' : '2px',
        '--tw-ring-color': selected ? color : undefined
      } as React.CSSProperties & { '--tw-ring-color'?: string }}
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
              {Array.from(node.values.entries()).map((entry: [string, any]) => (
                <div key={entry[0]}>
                  {entry[0]}: {JSON.stringify(entry[1])}
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
  showLabels?: boolean;
}

export const ThoughtGraph: React.FC<ThoughtGraphProps> = ({
  backgroundEdgeOpacity = 0.2,
  showArrows = false,
  showLabels = false
}) => {
  const { nodes: thoughtNodes } = useWebSocketThoughts();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    hoveredNodeId,
    setHoveredNodeId,
  } = useThoughtGraphState(thoughtNodes, backgroundEdgeOpacity, showArrows, showLabels);

  // Handle clearing selection when clicking on background or pressing escape
  const handlePaneClick = React.useCallback(() => {
    // Clear all selections
    const selectChanges: NodeChange[] = nodes.map(node => ({
      id: node.id,
      type: 'select' as const,
      selected: false,
    }));
    onNodesChange(selectChanges);
  }, [nodes, onNodesChange]);

  // Handle escape key to clear selection
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Clear all selections
        const selectChanges: NodeChange[] = nodes.map(node => ({
          id: node.id,
          type: 'select' as const,
          selected: false,
        }));
        onNodesChange(selectChanges);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, onNodesChange]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={["Meta", "Control"]}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => (node.data?.color as string) || '#6b7280'}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};