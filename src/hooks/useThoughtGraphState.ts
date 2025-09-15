import React from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { ThoughtNode } from '../lib/thought-system';
import {
  calculateCircleLayout,
  createStyledEdge,
  calculateOptimalHandles
} from '../lib/thought-graph-utils';

export const useThoughtGraphState = (thoughtNodes: Map<string, ThoughtNode>) => {
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);

  // Convert thought nodes to React Flow nodes and edges
  const { flowNodes, allEdges } = React.useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    const nodeArray = Array.from(thoughtNodes.values());

    nodeArray.forEach((thoughtNode: ThoughtNode, index: number) => {
      const { x, y } = calculateCircleLayout(nodeArray.length, index);

      flowNodes.push({
        id: thoughtNode.id,
        type: 'thoughtNode',
        position: { x, y },
        data: { node: thoughtNode },
        draggable: true,
      });

      // Create edges from relationships
      thoughtNode.relationships.forEach((rel, relIndex) => {
        const targetNode = nodeArray.find(n => n.id === rel.target);
        if (targetNode) {
          const targetIndex = nodeArray.indexOf(targetNode);
          const { x: targetX, y: targetY } = calculateCircleLayout(nodeArray.length, targetIndex);

          // Calculate direction and create edge with optimal handles
          const sourceNodeData = { position: { x, y } } as Node;
          const targetNodeData = { position: { x: targetX, y: targetY } } as Node;

          const edge = createStyledEdge(
            thoughtNode.id,
            rel.target,
            rel,
            relIndex,
            sourceNodeData,
            targetNodeData
          );

          flowEdges.push(edge);
        }
      });
    });

    return { flowNodes, allEdges: flowEdges };
  }, [thoughtNodes]);

  // Use nodes state to enable dragging
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);

  // Calculate handles for edges based on current node positions
  const calculateHandles = React.useCallback((sourceNode: Node, targetNode: Node) => {
    return calculateOptimalHandles(sourceNode, targetNode);
  }, []);

  // Filter and update edges based on hover state and current node positions
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

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    hoveredNodeId,
    setHoveredNodeId,
  };
};