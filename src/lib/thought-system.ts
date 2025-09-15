/**
 * Enhanced Cognitive Modeling System - Implementation
 *
 * Self-documenting TypeScript implementation with comprehensive type safety
 * Key insight: Intelligence as negotiation between mechanism and meaning
 *
 * @example Basic Usage
 * ```typescript
 * const session = new Session('my-session', 'Title', 'Description');
 *
 * session.thought('Concept')
 *   .means('What this concept represents')
 *   .hasValue('property', 0.8)
 *   .relatesTo('OtherConcept', 'supports', 0.9);
 * ```
 */

import type {
  Interval,
  NodeId,
  RelationType,
  ConfidenceLevel,
  RelationshipStrength,
  PropertyValue,
  Meaning,
  Relationship,
  MetaphorBranch,
  SessionMetadata,
  ThoughtBuilder,
  CognitiveOperations
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION CLASSES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single thought node with semantic and numerical properties
 * Implements fluent builder pattern for easy construction
 */
export class ThoughtNode implements ThoughtBuilder {
  public readonly id: NodeId;
  public readonly meanings: Meaning[] = [];
  public readonly values = new Map<string, PropertyValue>();
  public readonly relationships: Relationship[] = [];
  public readonly metaphorBranches: MetaphorBranch[] = [];
  public tension?: string;
  public readonly history: string[] = [];

  constructor(id: NodeId) {
    this.id = id;
    this.history.push(`Created node: ${id}`);
  }

  means(content: string, confidence: ConfidenceLevel = 1.0): this {
    this.meanings.push({
      content,
      confidence,
      timestamp: Date.now()
    });
    this.history.push(`Added meaning: "${content}"`);
    return this;
  }

  becomes(newMeaning: string): this {
    this.means(newMeaning, 0.9);
    this.history.push(`Transformed to: "${newMeaning}"`);
    return this;
  }

  hasValue(key: string, value: PropertyValue): this {
    this.values.set(key, value);
    this.history.push(`Set ${key} = ${JSON.stringify(value)}`);
    return this;
  }

  relatesTo(target: NodeId, type: RelationType, strength: RelationshipStrength = 1.0, gloss?: string): this {
    this.relationships.push({ type, target, strength, gloss });
    this.history.push(`Related to ${target} via ${type} (${strength})`);
    return this;
  }

  forkMetaphor(name: string, interpretation: string, initialWeight: number = 1.0): this {
    this.metaphorBranches.push({
      name,
      interpretation,
      weight: initialWeight,
      predictiveSuccess: 0
    });
    this.history.push(`Forked metaphor: ${name}`);
    return this;
  }

  holdsTension(description: string): this {
    this.tension = description;
    this.history.push(`Tension: ${description}`);
    return this;
  }

  observesSelf(observation: string): this {
    this.history.push(`Self-observation: ${observation}`);
    this.means(`Self-aware: ${observation}`, 0.8);
    return this;
  }

  applyHistoryAwareTransform(transformType: string, magnitude: number): this {
    const occurrences = this.history.filter(h => h.includes(transformType)).length;
    const adjustedMagnitude = magnitude / (1 + occurrences * 0.5);
    this.history.push(`Applied ${transformType} with adjusted magnitude: ${adjustedMagnitude}`);
    return this;
  }

  /**
   * Get the most recent meaning
   */
  currentMeaning(): string {
    return this.meanings[this.meanings.length - 1]?.content || '[undefined]';
  }

  /**
   * Get a property value
   */
  getValue(key: string): PropertyValue | undefined {
    return this.values.get(key);
  }

  /**
   * Get complete history of this thought's development
   */
  getProvenance(): readonly string[] {
    return [...this.history];
  }
}

/**
 * Container for a network of interconnected thoughts
 * Provides cognitive operations like propagation and metaphor collapse
 */
export class ThoughtSpace implements CognitiveOperations {
  private readonly nodes = new Map<NodeId, ThoughtNode>();
  private readonly globalHistory: string[] = [];
  private readonly listeners: Array<(space: ThoughtSpace) => void> = [];

  /**
   * Create or retrieve a thought node
   * @param id Unique thought identifier
   * @returns Fluent thought builder
   * @example thought('Consciousness').means('Awareness of being')
   */
  thought(id: NodeId): ThoughtNode {
    if (!this.nodes.has(id)) {
      const node = new ThoughtNode(id);
      this.nodes.set(id, node);
      this.globalHistory.push(`Created thought: ${id}`);
      this.notifyListeners();
    }
    return this.nodes.get(id)!;
  }

  collapseMetaphor(thoughtId: NodeId, context: string): string | null {
    const node = this.nodes.get(thoughtId);
    if (!node || node.metaphorBranches.length === 0) return null;

    let bestBranch = node.metaphorBranches[0];
    let bestScore = 0;

    for (const branch of node.metaphorBranches) {
      const contextRelevance = branch.interpretation.toLowerCase().includes(context.toLowerCase()) ? 2 : 1;
      const score = branch.predictiveSuccess * contextRelevance * branch.weight;

      if (score > bestScore) {
        bestScore = score;
        bestBranch = branch;
      }
    }

    this.globalHistory.push(`Collapsed ${thoughtId} to metaphor: ${bestBranch.name} in context: ${context}`);
    this.notifyListeners();
    return bestBranch.interpretation;
  }

  propagate(fromId: NodeId, propertyKey: string): void {
    const fromNode = this.nodes.get(fromId);
    if (!fromNode) return;

    const value = fromNode.getValue(propertyKey);
    if (value === undefined) return;

    for (const rel of fromNode.relationships) {
      if (rel.type === 'causes') {
        const targetNode = this.nodes.get(rel.target);
        if (targetNode) {
          let propagatedValue: PropertyValue;
          if (typeof value === 'number') {
            propagatedValue = value * rel.strength;
          } else {
            propagatedValue = [value[0] * rel.strength, value[1] * rel.strength];
          }

          targetNode.hasValue(propertyKey, propagatedValue);
          this.globalHistory.push(`Propagated ${propertyKey} from ${fromId} to ${rel.target}`);
        }
      }
    }
    this.notifyListeners();
  }

  reflect(): string {
    const nodeCount = this.nodes.size;
    const totalMeanings = Array.from(this.nodes.values()).reduce((sum, node) => sum + node.meanings.length, 0);
    const totalRelationships = Array.from(this.nodes.values()).reduce((sum, node) => sum + node.relationships.length, 0);

    return `ThoughtSpace contains ${nodeCount} nodes, ${totalMeanings} meanings, ${totalRelationships} relationships`;
  }

  getAllNodes(): ReadonlyMap<NodeId, ThoughtNode> {
    return new Map(this.nodes);
  }

  subscribe(listener: (space: ThoughtSpace) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Export complete state as JSON-serializable object
   */
  serialize(): object {
    const serialized: any = {
      nodes: {},
      globalHistory: this.globalHistory
    };

    for (const [id, node] of this.nodes) {
      serialized.nodes[id] = {
        id: node.id,
        meanings: node.meanings,
        values: Object.fromEntries(node.values),
        relationships: node.relationships,
        metaphorBranches: node.metaphorBranches,
        tension: node.tension,
        history: node.history
      };
    }

    return serialized;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this));
  }
}

/**
 * High-level session wrapper with metadata
 * Provides clean API for cognitive modeling with automatic context tracking
 */
export class Session implements CognitiveOperations {
  public readonly metadata: SessionMetadata;
  private readonly thoughtSpace: ThoughtSpace;

  /**
   * Create a new cognitive modeling session
   * @param id Unique session identifier
   * @param title Human-readable title
   * @param description What this session explores
   * @example new Session('exploration-20250915', 'Mind Modeling', 'Exploring consciousness')
   */
  constructor(id: string, title: string, description: string) {
    this.metadata = {
      id,
      title,
      description,
      createdAt: Date.now()
    };
    this.thoughtSpace = new ThoughtSpace();
  }

  /**
   * Create or retrieve a thought in this session
   * @param id Thought identifier
   * @returns Fluent thought builder
   * @example session.thought('Awareness').means('Being conscious')
   */
  thought(id: NodeId): ThoughtNode {
    return this.thoughtSpace.thought(id);
  }

  // Delegate all cognitive operations to the thought space
  collapseMetaphor(thoughtId: NodeId, context: string): string | null {
    return this.thoughtSpace.collapseMetaphor(thoughtId, context);
  }

  propagate(fromId: NodeId, propertyKey: string): void {
    this.thoughtSpace.propagate(fromId, propertyKey);
  }

  reflect(): string {
    return this.thoughtSpace.reflect();
  }

  getAllNodes(): ReadonlyMap<NodeId, ThoughtNode> {
    return this.thoughtSpace.getAllNodes();
  }

  subscribe(listener: (space: ThoughtSpace) => void): () => void {
    return this.thoughtSpace.subscribe(listener);
  }

  /**
   * Serialize complete session including metadata and all thoughts
   */
  serialize(): object {
    return {
      metadata: this.metadata,
      thoughtSpace: this.thoughtSpace.serialize()
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Global thought space for quick experimentation
 */
export const globalThoughtSpace = new ThoughtSpace();

/**
 * Quick thought creation function
 * @param id Thought identifier
 * @returns Fluent thought builder
 * @example thought('Idea').means('A concept forming')
 */
export const thought = (id: NodeId) => globalThoughtSpace.thought(id);