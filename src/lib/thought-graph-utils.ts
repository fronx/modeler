import { Node, Edge, MarkerType } from '@xyflow/react';

// Helper function to get edge color based on relationship type
export const getEdgeColor = (type: string): string => {
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

// Calculate best handles based on node positions
export const calculateOptimalHandles = (sourceNode: Node, targetNode: Node) => {
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
};

// Position nodes in a circle layout
export const calculateCircleLayout = (nodeCount: number, index: number, radius: number = 200) => {
  const adjustedRadius = Math.max(radius, nodeCount * 50);
  const angle = (index / nodeCount) * 2 * Math.PI;
  const x = Math.cos(angle) * adjustedRadius;
  const y = Math.sin(angle) * adjustedRadius;
  return { x, y };
};

// Create edge with optimal styling and handles
export const createStyledEdge = (
  sourceId: string,
  targetId: string,
  relationship: any,
  index: number,
  sourceNode?: Node,
  targetNode?: Node
): Edge => {
  const baseEdge: Edge = {
    id: `${sourceId}-${targetId}-${index}`,
    source: sourceId,
    target: targetId,
    animated: relationship.type === 'causes',
    label: `${relationship.type} (${relationship.strength})`,
    labelStyle: { fontSize: 12, fill: '#000', fontWeight: 'bold' },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: getEdgeColor(relationship.type),
    },
    style: {
      stroke: getEdgeColor(relationship.type),
      strokeWidth: 3,
      strokeDasharray: relationship.type === 'causes' ? '5,5' : undefined,
    },
    data: { relationship },
  };

  // Add optimal handles if nodes are provided
  if (sourceNode && targetNode) {
    const { sourceHandle, targetHandle } = calculateOptimalHandles(sourceNode, targetNode);
    return {
      ...baseEdge,
      sourceHandle,
      targetHandle,
    };
  }

  return baseEdge;
};