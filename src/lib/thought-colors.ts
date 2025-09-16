/**
 * Transitive Color Calculation for Thought Nodes
 *
 * This system calculates node colors based on their ideological positions and relationships:
 * 1. Nodes with explicit positions get colors from complementary pairs (avoiding red spectrum)
 * 2. Other nodes inherit colors transitively based on support relationships
 * 3. Nodes supporting multiple conflicting positions become neutral (gray)
 * 4. Color intensity reflects strength of positional association
 */

// Color utilities
const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Generate complementary colors avoiding red spectrum (0-30 and 330-360 degrees)
const generateComplementaryColors = (numPositions: number): string[] => {
  if (numPositions === 1) {
    return [hslToHex(240, 70, 50)]; // Blue for single position
  }

  if (numPositions === 2) {
    // Classic complementary pair: blue and orange
    return [
      hslToHex(240, 70, 50), // Blue
      hslToHex(30, 80, 55),  // Orange (avoiding red by staying at 30°)
    ];
  }

  // For 3+ positions, distribute evenly around color wheel, avoiding red (0-30, 330-360)
  const availableRange = 300; // 30° to 330° (avoiding red spectrum)
  const startHue = 30;
  const colors: string[] = [];

  for (let i = 0; i < numPositions; i++) {
    const hue = startHue + (i * availableRange) / numPositions;
    colors.push(hslToHex(hue, 70, 50));
  }

  return colors;
};

// Calculate transitive color influence
interface ColorInfluence {
  color: string;
  strength: number;
}

interface ThoughtNode {
  id: string;
  semanticPosition?: number;
  relationships: Array<{
    type: 'supports' | 'conflicts-with';
    target: string;
    strength: number;
  }>;
}

export const calculateNodeColors = (nodes: ThoughtNode[]): Map<string, string> => {
  const nodeColors = new Map<string, string>();

  // Step 1: Identify nodes with explicit positions
  const positionedNodes = nodes
    .filter(node => node.semanticPosition !== undefined && node.semanticPosition !== 0)
    .sort((a, b) => (a.semanticPosition || 0) - (b.semanticPosition || 0));

  // Step 2: Generate complementary colors for positioned nodes
  const positionColors = generateComplementaryColors(positionedNodes.length);

  // Assign colors to explicitly positioned nodes
  positionedNodes.forEach((node, index) => {
    nodeColors.set(node.id, positionColors[index]);
  });

  // Step 3: Calculate transitive colors for unpositioned nodes
  const unpositionedNodes = nodes.filter(node =>
    node.semanticPosition === undefined || node.semanticPosition === 0
  );

  for (const node of unpositionedNodes) {
    const influences: ColorInfluence[] = [];

    // Collect color influences from supported nodes
    for (const rel of node.relationships) {
      if (rel.type === 'supports' && rel.strength > 0) {
        const targetColor = nodeColors.get(rel.target);
        if (targetColor) {
          influences.push({
            color: targetColor,
            strength: Math.abs(rel.strength)
          });
        }
      }
    }

    // Also check incoming support relationships
    for (const otherNode of nodes) {
      for (const rel of otherNode.relationships) {
        if (rel.type === 'supports' && rel.target === node.id && rel.strength > 0) {
          const sourceColor = nodeColors.get(otherNode.id);
          if (sourceColor) {
            influences.push({
              color: sourceColor,
              strength: Math.abs(rel.strength)
            });
          }
        }
      }
    }

    // Calculate blended color
    if (influences.length === 0) {
      // No influences = neutral gray
      nodeColors.set(node.id, '#6b7280');
    } else if (influences.length === 1) {
      // Single influence = inherit that color (potentially dimmed)
      const influence = influences[0];
      const dimmedColor = dimColor(influence.color, Math.min(influence.strength, 1.0));
      nodeColors.set(node.id, dimmedColor);
    } else {
      // Multiple influences = blend colors or go gray if conflicting
      const blendedColor = blendColorInfluences(influences);
      nodeColors.set(node.id, blendedColor);
    }
  }

  return nodeColors;
};

// Blend multiple color influences, going toward gray for conflicting influences
const blendColorInfluences = (influences: ColorInfluence[]): string => {
  // Group influences by similar colors
  const colorGroups = new Map<string, number>();
  let totalStrength = 0;

  for (const influence of influences) {
    const existing = colorGroups.get(influence.color) || 0;
    colorGroups.set(influence.color, existing + influence.strength);
    totalStrength += influence.strength;
  }

  // If multiple distinct colors with significant strength, move toward gray
  if (colorGroups.size > 1) {
    const maxStrength = Math.max(...colorGroups.values());
    const secondMaxStrength = [...colorGroups.values()]
      .sort((a, b) => b - a)[1] || 0;

    // If the conflict is significant (second strongest is >40% of strongest), go gray
    if (secondMaxStrength / maxStrength > 0.4) {
      return '#6b7280'; // Neutral gray
    }
  }

  // Otherwise, blend toward the dominant color
  const dominantColor = [...colorGroups.entries()]
    .sort(([,a], [,b]) => b - a)[0][0];
  const dominantStrength = colorGroups.get(dominantColor)! / totalStrength;

  return dimColor(dominantColor, dominantStrength);
};

// Dim a color based on strength (lower strength = more toward gray)
const dimColor = (hexColor: string, strength: number): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Gray values for blending
  const grayR = 107, grayG = 114, grayB = 128; // #6b7280

  // Blend toward gray based on (1 - strength)
  const blendFactor = 1 - Math.min(strength, 1);
  const newR = Math.round(r * (1 - blendFactor) + grayR * blendFactor);
  const newG = Math.round(g * (1 - blendFactor) + grayG * blendFactor);
  const newB = Math.round(b * (1 - blendFactor) + grayB * blendFactor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

// Export for testing
export { generateComplementaryColors, blendColorInfluences, dimColor };