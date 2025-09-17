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
  // Initialize expanded nodes with all nodes that have branches
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    thoughtNodes.forEach((node, nodeId) => {
      if (node.branches && node.branches.size > 0) {
        initialExpanded.add(nodeId);
      }
    });
    return initialExpanded;
  });

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

  // Update expanded nodes when thoughtNodes change (auto-expand nodes with branches)
  React.useEffect(() => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      thoughtNodes.forEach((node, nodeId) => {
        if (node.branches && node.branches.size > 0) {
          newExpanded.add(nodeId);
        }
      });
      return newExpanded;
    });
  }, [thoughtNodes]);

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

  // Helper function to calculate optimal group size that fits child nodes
  const calculateOptimalGroupBounds = (branches: Array<[string, any]>) => {
    if (branches.length === 0) return { width: 400, height: 200 };

    // Calculate container size based on actual child node layout
    const branchCount = branches.length;
    const nodeWidth = 180; // Max width of branch nodes (from BranchNodeComponent)
    const nodeHeight = 100; // Approximate height of branch nodes
    const padding = 20; // Base padding
    const headerHeight = 80; // Space for group header
    const spacing = 20; // Spacing between nodes

    // Calculate grid layout: 2 columns
    const columns = 2;
    const rows = Math.ceil(branchCount / columns);

    // Calculate exact dimensions needed
    const contentWidth = columns * nodeWidth + (columns - 1) * spacing;
    const contentHeight = headerHeight + (rows * nodeHeight) + ((rows - 1) * spacing);

    // Add padding around content
    const totalWidth = contentWidth + (padding * 2);
    const totalHeight = contentHeight + (padding * 2);

    return {
      width: totalWidth,
      height: totalHeight
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
          const bounds = calculateOptimalGroupBounds(branches);
          return {
            width: bounds.width,
            height: bounds.height,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '2px dashed #3b82f6',
            borderRadius: '12px',
            overflow: 'visible' // Allow children to extend beyond if needed
          };
        })() : {
          minWidth: 200,
          minHeight: 100
        },
        draggable: true,
        selectable: true,
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

      // Create edges from branch relationships - but only when branches are expanded and nodes exist
      if (isExpanded && thoughtNode.branches.size > 0) {
        thoughtNode.branches.forEach((branchData: any, branchName: string) => {
          branchData.relationships.forEach((rel: any, relIndex: number) => {
            const targetNode = nodeArray.find(n => n.id === rel.target);
            if (targetNode && layoutPositions.get(targetNode.id)) {
              const targetPosition = layoutPositions.get(targetNode.id)!;
              const branchId = `${thoughtNode.id}__branch__${branchName}`;

              // Only create edge if the branch node will actually exist in flowNodes
              const branchIndex = Array.from(thoughtNode.branches.keys()).indexOf(branchName);
              const sourcePosition = {
                x: x + 20 + (branchIndex % 2) * 200,
                y: y + 120 + Math.floor(branchIndex / 2) * 100
              };

              const edge = createStyledEdge(
                branchId,
                rel.target,
                rel,
                relIndex,
                { position: sourcePosition } as Node,
                { position: targetPosition } as Node,
                showArrows,
                showLabels
              );

              // Mark edges from branches with special styling
              edge.style = {
                ...edge.style,
                strokeDasharray: '5,5', // Dashed lines for branch relationships
                opacity: branchData.isActive ? 0.8 : 0.4
              };
              edge.zIndex = 1; // Render above parent group

              // Ensure unique edge ID to avoid conflicts
              edge.id = `${thoughtNode.id}-branch-${branchName}-${rel.target}-${relIndex}`;
              edge.source = branchId;
              edge.target = rel.target;

              flowEdges.push(edge);
            }
          });
        });
      }
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