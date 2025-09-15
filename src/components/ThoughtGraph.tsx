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
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWebSocketThoughts } from '../lib/websocket-thought-client';
import { ThoughtNode } from '../lib/thought-system';

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
        const targetNode = nodeArray.find(n => n.id === rel.target);
        if (targetNode) {
          const targetIndex = nodeArray.indexOf(targetNode);
          const targetAngle = (targetIndex / nodeArray.length) * 2 * Math.PI;
          const targetX = Math.cos(targetAngle) * radius;
          const targetY = Math.sin(targetAngle) * radius;

          // Calculate direction from source to target
          const deltaX = targetX - x;
          const deltaY = targetY - y;

          // Determine best handles based on direction
          let sourceHandle = 'source-right';
          let targetHandle = 'target-left';

          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal connection
            if (deltaX > 0) {
              sourceHandle = 'source-right';
              targetHandle = 'target-left';
            } else {
              sourceHandle = 'source-left';
              targetHandle = 'target-right';
            }
          } else {
            // Vertical connection
            if (deltaY > 0) {
              sourceHandle = 'source-bottom';
              targetHandle = 'target-top';
            } else {
              sourceHandle = 'source-top';
              targetHandle = 'target-bottom';
            }
          }

          const edge = {
            id: `${thoughtNode.id}-${rel.target}-${relIndex}`,
            source: thoughtNode.id,
            target: rel.target,
            sourceHandle,
            targetHandle,
            animated: rel.type === 'causes',
            label: `${rel.type} (${rel.strength})`,
            labelStyle: { fontSize: 12, fill: '#000', fontWeight: 'bold' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: getEdgeColor(rel.type),
            },
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

  // Function to calculate best handles based on node positions
  const calculateHandles = React.useCallback((sourceNode: Node, targetNode: Node) => {
    const deltaX = targetNode.position.x - sourceNode.position.x;
    const deltaY = targetNode.position.y - sourceNode.position.y;

    let sourceHandle = 'source-right';
    let targetHandle = 'target-left';

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal connection
      if (deltaX > 0) {
        sourceHandle = 'source-right';
        targetHandle = 'target-left';
      } else {
        sourceHandle = 'source-left';
        targetHandle = 'target-right';
      }
    } else {
      // Vertical connection
      if (deltaY > 0) {
        sourceHandle = 'source-bottom';
        targetHandle = 'target-top';
      } else {
        sourceHandle = 'source-top';
        targetHandle = 'target-bottom';
      }
    }

    return { sourceHandle, targetHandle };
  }, []);

  // Use nodes state to enable dragging
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);

  // Filter edges to only show those connected to hovered node and update handles
  const visibleEdges = React.useMemo(() => {
    if (!hoveredNodeId) return [];

    const filteredEdges = allEdges.filter(edge =>
      edge.source === hoveredNodeId || edge.target === hoveredNodeId
    );

    // Update handles based on current node positions
    return filteredEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const { sourceHandle, targetHandle } = calculateHandles(sourceNode, targetNode);
        return {
          ...edge,
          sourceHandle,
          targetHandle,
        };
      }
      return edge;
    });
  }, [allEdges, hoveredNodeId, nodes, calculateHandles]);

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