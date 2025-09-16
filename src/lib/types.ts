/**
 * Cognitive Modeling System - Type Definitions
 * Self-documenting types for code-as-gesture cognitive modeling
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Uncertainty interval [min, max] representing range of possible values */
export type Interval = readonly [number, number];

/** Unique identifier for thoughts - use PascalCase: 'Consciousness' | 'SelfAwareness' */
export type NodeId = string;

/** Confidence level (0-1): 0.9 = high | 0.5 = uncertain | 0.1 = speculative */
export type ConfidenceLevel = number;

/** Relationship strength (0+): 1.0 = fundamental | 0.7 = strong | 0.3 = weak */
export type RelationshipStrength = number;

/** Property values: number | [min, max] interval */
export type PropertyValue = number | Interval;

/** Focus level (-1 to 1): 1.0 = highlighted | undefined = neutral | -1.0 = discarded/dimmed */
export type FocusLevel = number;

/** Semantic position (-1 to +1): -1 = left pole | 0 = neutral/center | +1 = right pole */
export type SemanticPosition = number;

/**
 * Simplified semantic relationships between thoughts
 * @example 'supports' - A reinforces or validates B (positive relationship)
 * @example 'conflicts-with' - A contradicts or opposes B (negative relationship)
 */
export type RelationType = 'supports' | 'conflicts-with';

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════════════════════

/** Semantic meaning with confidence and timestamp */
export interface Meaning {
  content: string;
  confidence: ConfidenceLevel;
  timestamp: number;
}

/** Directed relationship between thoughts */
export interface Relationship {
  type: RelationType;
  target: NodeId;
  strength: RelationshipStrength;
  gloss?: string;
}

/** Metaphorical interpretation held in superposition */
export interface MetaphorBranch {
  name: string;
  interpretation: string;
  weight: number;
  predictiveSuccess: number;
}

/** Space metadata */
export interface SpaceMetadata {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLUENT API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chainable thought building interface
 * @example thought('Mind').means('Cognitive system').hasValue('complexity', 0.8)
 */
export interface ThoughtBuilder {
  /** Add semantic meaning: .means('What this represents', 0.9) */
  means(content: string, confidence?: ConfidenceLevel): this;

  /** Transform meaning: .becomes('New understanding') */
  becomes(newMeaning: string): this;

  /** Add property: .hasValue('complexity', 0.8) | .hasValue('range', [0.3, 0.7]) */
  hasValue(key: string, value: PropertyValue): this;

  /** Support relationship: .supports('OtherThought', 0.8) */
  supports(target: NodeId, strength?: RelationshipStrength): this;

  /** Conflict relationship: .conflictsWith('OpposingThought', 0.7) */
  conflictsWith(target: NodeId, strength?: RelationshipStrength): this;

  /** Add metaphor: .forkMetaphor('ocean', 'Deep and mysterious', 1.2) */
  forkMetaphor(name: string, interpretation: string, initialWeight?: number): this;

  /** Express tension: .holdsTension('Between certainty and doubt') */
  holdsTension(description: string): this;

  /** Self-observation: .observesSelf('This thought observes itself') */
  observesSelf(observation: string): this;

  /** History-aware transform: .applyHistoryAwareTransform('refinement', 0.8) */
  applyHistoryAwareTransform(transformType: string, magnitude: number): this;

  /** Set focus level: .setFocus(1.0) | .setFocus(0.3) - 1.0 = full focus, 0.0 = background */
  setFocus(level: FocusLevel): this;

  /** Set semantic position: .setPosition(-1.0) | .setPosition(0.5) - left pole, center, right pole */
  setPosition(position: SemanticPosition): this;
}

/**
 * Cognitive operations on thought spaces
 * @example space.collapseMetaphor('Mind', 'processing') → computer metaphor
 */
export interface CognitiveOperations {
  /** Collapse metaphors based on context */
  collapseMetaphor(nodeId: NodeId, context: string): string | null;

  /** Propagate values through causal relationships */
  propagate(fromId: NodeId, key: string): void;

  /** Get space summary: "5 nodes, 12 meanings, 8 relationships" */
  reflect(): string;

  /** Subscribe to changes for real-time updates */
  subscribe(listener: (space: any) => void): () => void;
}