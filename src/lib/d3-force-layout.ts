/**
 * D3 Force-Directed Layout for Thought Networks
 *
 * Creates a left-right divided layout with radial expansion:
 * 1. Core nodes anchored to left/right based on semantic position
 * 2. Supporting nodes positioned radially around their core
 * 3. Strong separation between left and right sides
 * 4. Relationship forces create natural clustering
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum
} from 'd3-force';

interface ThoughtNode {
  id: string;
  semanticPosition?: number;
  relationships: Array<{
    type: 'supports' | 'conflicts-with';
    target: string;
    strength: number;
  }>;
}

interface D3Node extends SimulationNodeDatum {
  id: string;
  originalNode: ThoughtNode;
  isCore: boolean;
  corePosition?: number;
  side: 'left' | 'right' | 'neutral';
  layer: number; // Distance from core (0 = core, 1 = direct support, 2 = indirect, etc.)
}

interface D3Link extends SimulationLinkDatum<D3Node> {
  type: 'supports' | 'conflicts-with';
  strength: number;
}

export interface LayoutPosition {
  x: number;
  y: number;
}

export const createAnimatedForceLayout = (
  nodes: ThoughtNode[],
  onTick: (positions: Map<string, LayoutPosition>) => void,
  onComplete: (positions: Map<string, LayoutPosition>) => void,
  options: {
    width?: number;
    height?: number;
    iterations?: number;
    linkStrength?: number;
    repulsionStrength?: number;
    anchoringStrength?: number;
    collisionRadius?: number;
  } = {}
) => {
  const {
    width = 1200,
    height = 800,
    iterations = 500,
    linkStrength = 0.3,
    repulsionStrength = -10,
    anchoringStrength = 10,
    collisionRadius = 180,
  } = options;

  // Simple approach: determine left vs right vs neutral based on semantic position
  const d3Nodes: D3Node[] = nodes.map(node => {
    const isCore = node.semanticPosition !== undefined && node.semanticPosition !== 0;

    // Determine side based on semantic position
    let side: 'left' | 'right' | 'neutral';
    if (node.semanticPosition === undefined || node.semanticPosition === 0) {
      side = 'neutral';
    } else if (node.semanticPosition < 0) {
      side = 'left';
    } else {
      side = 'right';
    }

    // Start nodes near their intended side, closer to center
    let sideOffset: number;
    if (side === 'left') {
      sideOffset = -150;
    } else if (side === 'right') {
      sideOffset = 150;
    } else {
      sideOffset = 0; // neutral nodes start in center
    }

    const initialX = width / 2 + sideOffset + (Math.random() - 0.5) * 250;
    const initialY = height / 2 + (Math.random() - 0.5) * 250;


    return {
      id: node.id,
      originalNode: node,
      isCore,
      corePosition: node.semanticPosition,
      side,
      layer: 0, // Simplified - no layers for now
      x: initialX,
      y: initialY
    };
  });

  // Convert relationships to D3 links
  const d3Links: D3Link[] = [];
  for (const node of nodes) {
    for (const rel of node.relationships) {
      const sourceNode = d3Nodes.find(n => n.id === node.id);
      const targetNode = d3Nodes.find(n => n.id === rel.target);

      if (sourceNode && targetNode) {

        d3Links.push({
          source: sourceNode,
          target: targetNode,
          type: rel.type,
          strength: Math.abs(rel.strength)
        });
      }
    }
  }

  // Simple simulation with just basic forces
  const simulation = forceSimulation(d3Nodes)
    // Collision detection to prevent overlap - larger radius for better spacing
    .force('collide', forceCollide().radius(collisionRadius).strength(1.0).iterations(3))

    // Basic repulsion to prevent overlap
    .force('charge', forceManyBody().strength(repulsionStrength))

    // Link forces for relationships
    .force('link', forceLink(d3Links)
      .id(d => (d as D3Node).id)
      .strength(link => {
        const l = link as D3Link;
        // Stronger link forces for neutral nodes to pull them toward their connections
        const sourceNode = l.source as D3Node;
        const targetNode = l.target as D3Node;
        const isNeutralInvolved = sourceNode.side === 'neutral' || targetNode.side === 'neutral';
        return isNeutralInvolved ? linkStrength * 2 : linkStrength;
      })
      // .distance(500)
    )

    // X anchoring only for left/right nodes, not neutral
    .force('anchorX', forceX().strength(node => {
      const n = node as D3Node;
      // Only anchor left/right nodes, let neutral nodes move freely
      return n.side === 'neutral' ? 0 : anchoringStrength;
    }).x(node => {
      const n = node as D3Node;
      const offset = n.side === 'left'
        ? -400
        : n.side === 'right'
          ? 400
          : 0;
      return width / 2 + offset;
    }))

    // Gentle Y centering
    .force('anchorY', forceY().strength(anchoringStrength * 0.1).y(height / 2));

  let iterationCount = 0;
  simulation.on('tick', () => {
    iterationCount++;

    // Only update positions every few ticks to make animation more visible
    if (iterationCount % 5 === 0) {
      const positions = new Map<string, LayoutPosition>();
      for (const node of d3Nodes) {
        positions.set(node.id, {
          x: node.x || 0,
          y: node.y || 0
        });
      }
      onTick(positions);
    }

    // Stop condition
    if (iterationCount >= iterations || simulation.alpha() < 0.01) {
      simulation.stop();
      // Final update
      const finalPositions = new Map<string, LayoutPosition>();
      for (const node of d3Nodes) {
        finalPositions.set(node.id, {
          x: node.x || 0,
          y: node.y || 0
        });
      }
      onComplete(finalPositions);
    }
  });

  simulation.restart();

  // Return control object to allow external stopping
  return {
    stop: () => simulation.stop(),
    restart: () => simulation.restart(),
    alpha: () => simulation.alpha()
  };
};

