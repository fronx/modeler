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
import { calculateNodeColors } from '../lib/thought-colors';
import { createAnimatedForceLayout } from '../lib/d3-force-layout';

export const useThoughtGraphState = (
  thoughtNodes: Map<string, ThoughtNode>,
  backgroundEdgeOpacity: number = 0.2,
  showArrows: boolean = false,
  showLabels: boolean = false
) => {
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [layoutPositions, setLayoutPositions] = React.useState<Map<string, { x: number; y: number }>>(new Map());
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set());

  // Toggle expansion state for a node
  const toggleNodeExpansion = React.useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Calculate D3 force layout when nodes change - use animated version
  React.useEffect(() => {
    const nodeArray = Array.from(thoughtNodes.values()).filter(node => node.focus !== -1);
    if (nodeArray.length === 0) return;

    setIsAnimating(true);

    const simulation = createAnimatedForceLayout(
      nodeArray,
      // onTick - update positions in real-time
      (positions) => {
        setLayoutPositions(positions);
      },
      // onComplete - animation finished
      (finalPositions) => {
        setLayoutPositions(finalPositions);
        setIsAnimating(false);
      },
      {
        width: 1200,
        height: 800,
        iterations: 200,
        linkStrength: 0.3,
        repulsionStrength: -50,
        anchoringStrength: 0.3
      }
    );

    // Clean up simulation on unmount
    return () => {
      simulation.stop();
      setIsAnimating(false);
    };
  }, [thoughtNodes]);

  // Helper function to calculate generous group size that allows expansion
  const calculateGenerousGroupBounds = (branches: Array<[string, any]>) => {
    if (branches.length === 0) return { width: 800, height: 600 };

    // Calculate a generous container size that allows for dragging in all directions
    const branchCount = branches.length;
    const minWidth = 800; // Generous minimum width
    const minHeight = 600; // Generous minimum height

    // Scale container based on number of branches, with extra space for dragging
    const scaledWidth = Math.max(minWidth, branchCount * 150 + 400);
    const scaledHeight = Math.max(minHeight, Math.ceil(branchCount / 2) * 120 + 300);

    return {
      width: scaledWidth,
      height: scaledHeight
    };
  };

  // Convert thought nodes to React Flow nodes and edges
  const { flowNodes, allEdges } = React.useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    const nodeArray = Array.from(thoughtNodes.values()).filter(node => node.focus !== -1);

    // Calculate node colors based on positions and relationships
    const nodeColors = calculateNodeColors(nodeArray);

    nodeArray.forEach((thoughtNode: ThoughtNode) => {
      const position = layoutPositions.get(thoughtNode.id) || { x: 0, y: 0 };
      const { x, y } = position;

      const hasExpandableBranches = thoughtNode.branches.size > 0;
      const isExpanded = expandedNodes.has(thoughtNode.id);

      // When expanded and has branches, use group type for sub-flow
      const nodeType = isExpanded && hasExpandableBranches ? 'group' : 'thoughtNode';

      flowNodes.push({
        id: thoughtNode.id,
        type: nodeType,
        position: { x, y },
        data: {
          node: thoughtNode,
          color: nodeColors.get(thoughtNode.id) || '#6b7280',
          hasExpandableBranches,
          isExpanded,
          onToggleExpansion: () => toggleNodeExpansion(thoughtNode.id)
        },
        style: isExpanded && hasExpandableBranches ? (() => {
          const branches = Array.from(thoughtNode.branches.entries());
          const bounds = calculateGenerousGroupBounds(branches);
          return {
            width: bounds.width,
            height: bounds.height,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '2px dashed #3b82f6',
            borderRadius: '12px',
            padding: '20px',
            overflow: 'visible' // Allow children to extend beyond if needed
          };
        })() : {
          minWidth: 200,
          minHeight: 100
        },
        draggable: true,
        selectable: true,
        resizable: isExpanded && hasExpandableBranches, // Make group resizable when expanded
      });

      // Add branch nodes as children in sub-flow if expanded
      if (isExpanded && thoughtNode.branches.size > 0) {
        const branches = Array.from(thoughtNode.branches.entries());
        branches.forEach(([branchName, branchData], index) => {
          const branchId = `${thoughtNode.id}__branch__${branchName}`;
          const branchX = 20 + (index % 2) * 200; // Two columns with more spacing
          const branchY = 120 + Math.floor(index / 2) * 100; // Rows with more spacing

          flowNodes.push({
            id: branchId,
            type: 'branchNode',
            position: { x: branchX, y: branchY }, // Relative to parent group
            data: {
              branch: branchData,
              parentId: thoughtNode.id,
              color: branchData.isActive ? '#10b981' : '#6b7280' // Green for active, gray for inactive
            },
            parentId: thoughtNode.id, // ReactFlow sub-flow parent-child relationship
            expandParent: true, // Auto-expand parent when dragged beyond bounds
            draggable: true, // Make branch nodes draggable
            selectable: true,
          });

          // Create edges from branch relationships to other thoughts
          branchData.relationships.forEach((rel: any, relIndex: number) => {
            const targetNode = nodeArray.find(n => n.id === rel.target);
            if (targetNode) {
              const edge = createStyledEdge(
                branchId,
                rel.target,
                rel,
                relIndex,
                { position: { x: x + branchX, y: y + branchY } } as Node, // Absolute position for edge calculation
                { position: layoutPositions.get(targetNode.id) || { x: 0, y: 0 } } as Node,
                showArrows,
                showLabels
              );
              // Mark edges from branches with special styling
              edge.style = {
                ...edge.style,
                strokeDasharray: '5,5', // Dashed lines for branch relationships
                opacity: branchData.isActive ? 1 : 0.5
              };
              flowEdges.push(edge);
            }
          });
        });
      }

      // Create edges from relationships
      thoughtNode.relationships.forEach((rel, relIndex) => {
        const targetNode = nodeArray.find(n => n.id === rel.target);
        if (targetNode) {
          const targetPosition = layoutPositions.get(targetNode.id) || { x: 0, y: 0 };
          const { x: targetX, y: targetY } = targetPosition;

          // Calculate direction and create edge with optimal handles
          const sourceNodeData = { position: { x, y } } as Node;
          const targetNodeData = { position: { x: targetX, y: targetY } } as Node;

          const edge = createStyledEdge(
            thoughtNode.id,
            rel.target,
            rel,
            relIndex,
            sourceNodeData,
            targetNodeData,
            showArrows,
            showLabels
          );

          flowEdges.push(edge);
        }
      });
    });

    return { flowNodes, allEdges: flowEdges };
  }, [thoughtNodes, layoutPositions, expandedNodes, toggleNodeExpansion]);

  // Use nodes state to enable dragging
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);

  // Calculate handles for edges based on current node positions
  const calculateHandles = React.useCallback((sourceNode: Node, targetNode: Node) => {
    return calculateOptimalHandles(sourceNode, targetNode);
  }, []);

  // Calculate edge styling based on connected node centrality and hover state
  const visibleEdges = React.useMemo(() => {
    const styledEdges = allEdges.map(edge => {
      const sourceNode = Array.from(thoughtNodes.values()).find(n => n.id === edge.source);
      const targetNode = Array.from(thoughtNodes.values()).find(n => n.id === edge.target);

      if (!sourceNode || !targetNode) return edge;

      // Calculate edge centrality based on connected nodes
      const sourceFocus = sourceNode.focus || 0.1;
      const targetFocus = targetNode.focus || 0.1;

      // Use the higher focus level to determine edge prominence
      const maxFocus = Math.max(sourceFocus, targetFocus);

      // Boost focus if either node is hovered
      const isHoveredEdge = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
      const effectiveFocus = isHoveredEdge ? Math.max(maxFocus, 0.8) : maxFocus;

      // Calculate thickness based on centrality
      const baseStrokeWidth = (edge.style?.strokeWidth as number) || 3;
      const relationship = edge.data?.relationship;
      const typeMultiplier = relationship && typeof relationship === 'object' && 'type' in relationship && relationship.type === 'conflicts-with' ? 1.5 : 1.0; // Conflicts slightly thicker

      // Scale thickness: 0.5x to 2.5x based on focus level
      const focusMultiplier = 0.5 + (effectiveFocus * 2.0);
      const finalStrokeWidth = baseStrokeWidth * focusMultiplier * typeMultiplier;

      // Calculate opacity: high focus = full opacity, low focus = background opacity
      const opacity = effectiveFocus >= 0.7 ? 1.0 :
                     effectiveFocus >= 0.4 ? 0.6 :
                     backgroundEdgeOpacity;

      return {
        ...edge,
        style: {
          ...edge.style,
          strokeWidth: finalStrokeWidth,
          opacity: opacity
        }
      };
    });

    // Update handles based on current node positions
    return styledEdges.map(edge => {
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
  }, [allEdges, hoveredNodeId, nodes, thoughtNodes, calculateHandles, backgroundEdgeOpacity]);

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
    isAnimating,
    expandedNodes,
    toggleNodeExpansion,
  };
};