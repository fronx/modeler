import { Node, Edge, MarkerType } from '@xyflow/react';

// Helper function to get edge color based on relationship type
export const getEdgeColor = (type: string): string => {
  const colors: Record<string, string> = {
    supports: '#3b82f6', // blue
    'conflicts-with': '#ef4444', // red
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

// Calculate transitive focus based on connections to other nodes
export const calculateTransitiveFocus = (
  currentNode: any,
  allNodes: any[],
  baseFocus: number
): number => {
  let maxTransitiveFocus = 0;

  // Check all relationships this node has
  currentNode.relationships.forEach((rel: any) => {
    const connectedNode = allNodes.find(n => n.id === rel.target);
    if (connectedNode && connectedNode.focus > 0.5) { // Only inherit from meaningfully focused nodes
      // Inherit focus based on relationship strength, independent of base focus
      const inheritedFocus = connectedNode.focus * Math.abs(rel.strength || 0.7) * 0.8;
      maxTransitiveFocus = Math.max(maxTransitiveFocus, inheritedFocus);
    }
  });

  // Also check for incoming relationships (this node as target)
  allNodes.forEach(otherNode => {
    if (otherNode.focus > 0.5) { // Only inherit from meaningfully focused nodes
      otherNode.relationships.forEach((rel: any) => {
        if (rel.target === currentNode.id) {
          const inheritedFocus = otherNode.focus * Math.abs(rel.strength || 0.7) * 0.8;
          maxTransitiveFocus = Math.max(maxTransitiveFocus, inheritedFocus);
        }
      });
    }
  });

  // Use the higher of base focus or transitive focus, but give transitive focus a minimum boost
  const effectiveFocus = Math.max(baseFocus, maxTransitiveFocus);

  // If we have transitive focus, ensure minimum level of 0.6 for connected nodes
  if (maxTransitiveFocus > 0) {
    return Math.max(effectiveFocus, 0.6);
  }

  return Math.min(effectiveFocus, 1.0); // Cap at 1.0
};

// Position nodes with focus-aware layout (focused nodes gravitate toward center)
export const calculateFocusLayout = (
  nodeCount: number,
  index: number,
  focusLevel: number,
  baseRadius: number = 300,
  currentNode?: any,
  allNodes?: any[]
) => {
  // Calculate base circular position
  const adjustedRadius = Math.max(baseRadius, nodeCount * 50);
  const angle = (index / nodeCount) * 2 * Math.PI;

  // Calculate effective focus including transitive effects
  let effectiveFocus = focusLevel;
  if (currentNode && allNodes) {
    effectiveFocus = calculateTransitiveFocus(currentNode, allNodes, focusLevel);
  }

  // Focus affects distance from center: higher focus = closer to center
  // Use exponential curve for more dramatic effect at high focus levels
  const focusRadius = adjustedRadius * (1 - Math.pow(effectiveFocus, 2));

  const x = Math.cos(angle) * focusRadius;
  const y = Math.sin(angle) * focusRadius;
  return { x, y };
};

// Calculate semantic positioning with transitive influence
export const calculateSemanticPosition = (
  currentNode: any,
  allNodes: any[],
  basePosition: number
): number => {
  let totalInfluence = 0;
  let weightSum = 0;

  // Inherit semantic position from connected nodes
  currentNode.relationships.forEach((rel: any) => {
    const connectedNode = allNodes.find(n => n.id === rel.target);
    if (connectedNode) {
      const weight = Math.abs(rel.strength || 0.5);
      const influence = connectedNode.semanticPosition * weight;

      // Opposing relationships (negative strength) push away semantically
      if ((rel.strength || 0.5) < 0) {
        totalInfluence -= influence;
      } else {
        totalInfluence += influence;
      }
      weightSum += weight;
    }
  });

  // Also check incoming relationships
  allNodes.forEach(otherNode => {
    otherNode.relationships.forEach((rel: any) => {
      if (rel.target === currentNode.id) {
        const weight = Math.abs(rel.strength || 0.5);
        const influence = otherNode.semanticPosition * weight;

        if ((rel.strength || 0.5) < 0) {
          totalInfluence -= influence;
        } else {
          totalInfluence += influence;
        }
        weightSum += weight;
      }
    });
  });

  // Blend base position with transitive influence
  if (weightSum > 0) {
    const transitivePosition = totalInfluence / weightSum;
    // Weight the transitive influence more heavily for neutral nodes
    const blendFactor = Math.abs(basePosition) < 0.1 ? 0.8 : 0.3;
    return Math.max(-1, Math.min(1, basePosition * (1 - blendFactor) + transitivePosition * blendFactor));
  }

  return basePosition;
};

// Force-directed layout with semantic alignment
export const calculateSemanticFocusLayout = (
  nodeCount: number,
  index: number,
  focusLevel: number,
  semanticPosition: number,
  baseRadius: number = 300,
  currentNode?: any,
  allNodes?: any[]
) => {
  // Calculate base circular position
  const adjustedRadius = Math.max(baseRadius, nodeCount * 50);
  const angle = (index / nodeCount) * 2 * Math.PI;

  // Calculate effective focus including transitive effects
  let effectiveFocus = focusLevel;
  if (currentNode && allNodes) {
    effectiveFocus = calculateTransitiveFocus(currentNode, allNodes, focusLevel);
  }

  // Calculate effective semantic position including transitive effects
  let effectivePosition = semanticPosition;
  if (currentNode && allNodes) {
    effectivePosition = calculateSemanticPosition(currentNode, allNodes, semanticPosition);
  }

  // Focus affects distance from center (radial)
  const focusRadius = adjustedRadius * (1 - Math.pow(effectiveFocus, 2));

  // Semantic position affects horizontal displacement (left-right axis)
  const semanticOffset = effectivePosition * (adjustedRadius * 0.6); // Max 60% of radius horizontal displacement

  // Calculate final position: circular base + semantic horizontal offset
  const baseX = Math.cos(angle) * focusRadius;
  const baseY = Math.sin(angle) * focusRadius;

  // Apply semantic positioning as horizontal force
  const x = baseX + semanticOffset;
  const y = baseY;

  return { x, y };
};

// Create edge with optimal styling and handles
export const createStyledEdge = (
  sourceId: string,
  targetId: string,
  relationship: any,
  index: number,
  sourceNode?: Node,
  targetNode?: Node,
  showArrows: boolean = false,
  showLabels: boolean = false
): Edge => {
  const baseEdge: Edge = {
    id: `${sourceId}-${targetId}-${index}`,
    source: sourceId,
    target: targetId,
    animated: false,
    label: showLabels ? `${relationship.type} (${relationship.strength})` : undefined,
    labelStyle: showLabels ? { fontSize: 12, fill: '#000', fontWeight: 'bold' } : undefined,
    markerEnd: showArrows ? {
      type: MarkerType.ArrowClosed,
      color: getEdgeColor(relationship.type),
      width: 20,
      height: 20,
    } : undefined,
    style: {
      stroke: getEdgeColor(relationship.type),
      strokeWidth: 3,
      strokeDasharray: relationship.type === 'conflicts-with' ? '5,5' : undefined,
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