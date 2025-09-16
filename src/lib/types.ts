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

/**
 * How thoughts relate to each other - semantic relationship types
 * @example 'causes' - A directly produces B
 * @example 'supports' - A reinforces B
 * @example 'contradicts' - A conflicts with B
 * @example 'builds-on' - A extends B
 * @example 'transcends' - A goes beyond B
 */
export type RelationType =
  | 'causes' | 'supports' | 'contradicts' | 'means' | 'becomes'
  | 'observes' | 'enables' | 'builds-on' | 'transcends' | 'challenges'
  | 'implements' | 'fulfills' | 'validates' | 'based-on';

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

  /** Create relationship: .relatesTo('Other', 'supports', 0.9) */
  relatesTo(target: NodeId, type: RelationType, strength?: RelationshipStrength, gloss?: string): this;

  /** Add metaphor: .forkMetaphor('ocean', 'Deep and mysterious', 1.2) */
  forkMetaphor(name: string, interpretation: string, initialWeight?: number): this;

  /** Express tension: .holdsTension('Between certainty and doubt') */
  holdsTension(description: string): this;

  /** Self-observation: .observesSelf('This thought observes itself') */
  observesSelf(observation: string): this;

  /** History-aware transform: .applyHistoryAwareTransform('refinement', 0.8) */
  applyHistoryAwareTransform(transformType: string, magnitude: number): this;
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