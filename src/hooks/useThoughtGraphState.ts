import React from 'react';
import { Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { ThoughtNode } from '../lib/thought-system';
import {
  calculateCircleLayout,
  calculateFocusLayout,
  calculateSemanticFocusLayout,
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
      const { x, y } = calculateSemanticFocusLayout(
        nodeArray.length,
        index,
        thoughtNode.focus,
        thoughtNode.semanticPosition,
        300, // baseRadius
        thoughtNode,
        nodeArray
      );

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
          const { x: targetX, y: targetY } = calculateSemanticFocusLayout(
            nodeArray.length,
            targetIndex,
            targetNode.focus,
            targetNode.semanticPosition,
            300, // baseRadius
            targetNode,
            nodeArray
          );

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

  // Filter and update edges based on hover state, focus levels, and current node positions
  const visibleEdges = React.useMemo(() => {
    let filteredEdges = allEdges;

    // If no node is hovered, show edges for focused nodes (focus >= 0.7)
    if (!hoveredNodeId) {
      filteredEdges = allEdges.filter(edge => {
        const sourceNode = Array.from(thoughtNodes.values()).find(n => n.id === edge.source);
        const targetNode = Array.from(thoughtNodes.values()).find(n => n.id === edge.target);
        return (sourceNode && sourceNode.focus >= 0.7) || (targetNode && targetNode.focus >= 0.7);
      });
    } else {
      // When hovering, show edges for the hovered node
      filteredEdges = allEdges.filter(edge =>
        edge.source === hoveredNodeId || edge.target === hoveredNodeId
      );
    }

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
  }, [allEdges, hoveredNodeId, nodes, thoughtNodes, calculateHandles]);

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