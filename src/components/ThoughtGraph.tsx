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

// Custom node component for branch interpretations in sub-flows
const BranchNodeComponent: React.FC<{ data: any, selected?: boolean }> = ({ data, selected }) => {
  const { branch, color } = data;

  return (
    <div
      className={`relative px-3 py-2 rounded-lg shadow-sm border-2 min-w-[160px] max-w-[180px] transition-all duration-300 ${
        selected ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : ''
      } ${
        branch.isActive
          ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-500'
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600'
      }`}
      style={{
        borderColor: color
      }}
    >
      {/* Branch name and status */}
      <div className={`text-sm font-medium mb-1 flex items-center justify-between ${
        branch.isActive
          ? 'text-green-800 dark:text-green-200'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        <span className="flex items-center gap-1">
          {branch.name}
        </span>
        {!branch.isActive && (
          <span className="text-xs opacity-75">inactive</span>
        )}
      </div>

      {/* Branch interpretation */}
      {branch.interpretation && branch.interpretation !== branch.name && (
        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 italic">
          &ldquo;{branch.interpretation}&rdquo;
        </div>
      )}

      {/* Branch relationships */}
      {branch.relationships.length > 0 && (
        <div className="text-xs space-y-1">
          {branch.relationships.slice(0, 2).map((rel: any, idx: number) => (
            <div key={idx} className={`${rel.strength > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} truncate`}>
              {rel.type === 'supports' ? '→' : '×'} {rel.target}
            </div>
          ))}
          {branch.relationships.length > 2 && (
            <div className="text-xs text-gray-500">
              +{branch.relationships.length - 2} more
            </div>
          )}
        </div>
      )}

      {/* Branch values */}
      {branch.values && branch.values.size > 0 && (
        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
          {branch.values.size} value{branch.values.size !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

// Custom node component for thoughts with semantic zooming
const ThoughtNodeComponent: React.FC<{ data: any, selected?: boolean }> = ({ data, selected }) => {
  const { node, color, hasExpandableBranches, isExpanded, onToggleExpansion } = data;

  const [isManuallyExpanded, setIsManuallyExpanded] = React.useState(false);

  // Calculate detail level based on focus (three-state system)
  const focusLevel = node.focus;
  const isHighlighted = focusLevel === 1.0;
  const isDiscarded = focusLevel === -1.0;
  const isNeutral = focusLevel === undefined || focusLevel === null;

  // Highlighted nodes show full detail, neutral nodes show partial, discarded show minimal
  const naturalShowFullDetail = isHighlighted;
  const naturalShowPartialDetail = isHighlighted || isNeutral;

  // Override natural detail level if manually expanded
  const showFullDetail = isManuallyExpanded || naturalShowFullDetail;
  const showPartialDetail = isManuallyExpanded || naturalShowPartialDetail;

  const handleClick = (e: React.MouseEvent) => {
    // Don't stop propagation if Meta/Cmd key is held (for multi-selection)
    if (!e.metaKey && !e.ctrlKey) {
      e.stopPropagation();
      setIsManuallyExpanded(!isManuallyExpanded);
    }
    // If Meta/Cmd is held, let React Flow handle the selection
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleExpansion) {
      onToggleExpansion();
    }
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
        <div className="flex items-center gap-2">
          {/* Branch expand/collapse button */}
          {hasExpandableBranches && (
            <button
              onClick={handleExpandToggle}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800"
              title={isExpanded ? 'Collapse branches' : 'Expand branches'}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          {/* Detail expand/collapse indicator */}
          {!naturalShowFullDetail && (
            <span className="text-xs text-gray-400">
              {isManuallyExpanded ? '▼' : '▶'}
            </span>
          )}
        </div>
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
              Tension: {node.tension}
            </div>
          )}


          {/* Values */}
          {node.values.size > 0 && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {Array.from(node.values.entries() as [string, any][]).map(([key, value]) => (
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

// Group node component for expanded thoughts containing branches (sub-flows)
const GroupThoughtNodeComponent: React.FC<{ data: any, selected?: boolean }> = ({ data }) => {
  const { node, color, onToggleExpansion } = data;

  return (
    <div className="relative w-full h-full">
      {/* Group header with thought info - positioned absolutely within the group */}
      <div className="absolute top-2 left-2 right-2 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg" style={{ color }}>
            {node.id}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleExpansion) {
                onToggleExpansion();
              }
            }}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors px-2 py-1 rounded"
            title="Collapse branches"
          >
            Collapse
          </button>
        </div>

        {/* Current meaning */}
        {node.getCurrentMeaning && node.getCurrentMeaning() && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
            &ldquo;{node.getCurrentMeaning()}&rdquo;
          </div>
        )}
      </div>

      {/* Sub-flow area label */}
      <div className="absolute bottom-2 left-2 text-xs text-blue-600 dark:text-blue-400 font-medium z-10">
        Branch Interpretations
      </div>
    </div>
  );
};

// Node types
const nodeTypes = {
  thoughtNode: ThoughtNodeComponent,
  group: GroupThoughtNodeComponent, // React Flow's built-in group type
  branchNode: BranchNodeComponent,
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