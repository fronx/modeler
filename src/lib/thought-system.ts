/**
 * Enhanced Cognitive Modeling System - Implementation
 *
 * Self-documenting TypeScript implementation with comprehensive type safety
 * Key insight: Intelligence as negotiation between mechanism and meaning
 *
 * @example Basic Usage
 * ```typescript
 * const space = new Space('my-space', 'Title', 'Description');
 *
 * space.thought('Concept')
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
  FocusLevel,
  SemanticPosition,
  Meaning,
  Relationship,
  MetaphorBranch,
  BranchInterpretation,
  BranchResolution,
  SpaceMetadata,
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
  public meanings: Meaning[] = [];
  public readonly values = new Map<string, PropertyValue>();
  public relationships: Relationship[] = [];
  public metaphorBranches: MetaphorBranch[] = [];
  public branches: Map<string, BranchInterpretation> = new Map();
  public resolutions: BranchResolution[] = [];
  public tension?: string;
  public history: string[] = [];
  public focus: FocusLevel = 0.1; // Default to background
  public semanticPosition: SemanticPosition = 0.0; // Default to center/neutral
  private currentBranch?: string; // Track which branch operations apply to

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
    if (this.currentBranch) {
      const branch = this.branches.get(this.currentBranch);
      if (branch) {
        branch.values.set(key, value);
        this.history.push(`Branch "${this.currentBranch}": Set ${key} = ${JSON.stringify(value)}`);
      }
    } else {
      this.values.set(key, value);
      this.history.push(`Set ${key} = ${JSON.stringify(value)}`);
    }
    return this;
  }

  setFocus(level: FocusLevel): this {
    this.focus = Math.max(-1, Math.min(1, level)); // Clamp to [-1,1] to support discarded items
    this.history.push(`Focus set to ${this.focus}`);
    return this;
  }

  setPosition(position: SemanticPosition): this {
    this.semanticPosition = Math.max(-1, Math.min(1, position)); // Clamp to [-1,1]
    this.history.push(`Semantic position set to ${this.semanticPosition}`);
    return this;
  }

  supports(target: NodeId, strength: RelationshipStrength = 0.7): this {
    if (this.currentBranch) {
      const branch = this.branches.get(this.currentBranch);
      if (branch) {
        branch.relationships.push({ type: 'supports', target, strength });
        this.history.push(`Branch "${this.currentBranch}": Supports ${target} (${strength})`);
      }
    } else {
      this.relationships.push({ type: 'supports', target, strength });
      this.history.push(`Supports ${target} (${strength})`);
    }
    return this;
  }

  conflictsWith(target: NodeId, strength: RelationshipStrength = 0.7): this {
    if (this.currentBranch) {
      const branch = this.branches.get(this.currentBranch);
      if (branch) {
        branch.relationships.push({ type: 'conflicts-with', target, strength: -Math.abs(strength) });
        this.history.push(`Branch "${this.currentBranch}": Conflicts with ${target} (${Math.abs(strength)})`);
      }
    } else {
      this.relationships.push({ type: 'conflicts-with', target, strength: -Math.abs(strength) });
      this.history.push(`Conflicts with ${target} (${Math.abs(strength)})`);
    }
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

  branch(interpretation: string): this {
    // Create branch if it doesn't exist
    if (!this.branches.has(interpretation)) {
      const branch: BranchInterpretation = {
        name: interpretation,
        interpretation,
        relationships: [],
        values: new Map(),
        isActive: true
      };
      this.branches.set(interpretation, branch);
      this.history.push(`Added branch: ${interpretation}`);
    }

    // Set current branch for subsequent operations
    this.currentBranch = interpretation;
    return this;
  }

  resolve(resolution: { context: string; selections: string[]; reason: string }): this {
    const branchResolution: BranchResolution = {
      context: resolution.context,
      selections: resolution.selections,
      reason: resolution.reason,
      timestamp: Date.now()
    };

    this.resolutions.push(branchResolution);

    // Mark selected branches as active, others as inactive
    this.branches.forEach((branch, name) => {
      branch.isActive = resolution.selections.includes(name);
    });

    this.history.push(`Resolved to: ${resolution.selections.join(', ')} (${resolution.reason})`);
    this.currentBranch = undefined; // Clear current branch after resolution
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
      if (rel.type === 'supports' && rel.strength > 0) {
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

    this.nodes.forEach((node, id) => {
      // Convert branch Map to serializable object
      const branches: any = {};
      node.branches.forEach((branch, name) => {
        branches[name] = {
          name: branch.name,
          interpretation: branch.interpretation,
          relationships: branch.relationships,
          values: Object.fromEntries(branch.values),
          isActive: branch.isActive
        };
      });

      serialized.nodes[id] = {
        id: node.id,
        meanings: node.meanings,
        values: Object.fromEntries(node.values),
        relationships: node.relationships,
        metaphorBranches: node.metaphorBranches,
        branches: branches,
        resolutions: node.resolutions,
        tension: node.tension,
        focus: node.focus,
        semanticPosition: node.semanticPosition,
        history: node.history
      };
    });

    return serialized;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this));
  }
}

/**
 * High-level space wrapper with metadata
 * Provides clean API for cognitive modeling with automatic context tracking
 */
export class Space implements CognitiveOperations {
  public readonly metadata: SpaceMetadata;
  private readonly thoughtSpace: ThoughtSpace;

  /**
   * Create a new cognitive modeling space
   * @param id Unique space identifier
   * @param title Human-readable title
   * @param description What this space explores
   * @example new Space('exploration-20250915', 'Mind Modeling', 'Exploring consciousness')
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
   * Create or retrieve a thought in this space
   * @param id Thought identifier
   * @returns Fluent thought builder
   * @example space.thought('Awareness').means('Being conscious')
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
   * Serialize complete space including metadata and all thoughts
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