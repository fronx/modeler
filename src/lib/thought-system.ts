/**
 * Cognitive Modeling System - Executable code-as-gesture
 *
 * Combines semantic entities (Claude) with constraint propagation (GPT-5)
 * Key insight: Intelligence as negotiation between mechanism and meaning
 */

export type Interval = [number, number];
export type NodeId = string;
export type RelationType = 'causes' | 'supports' | 'contradicts' | 'means' | 'becomes' | 'observes' | 'enables' | 'builds-on' | 'transcends' | 'challenges' | 'implements' | 'fulfills' | 'validates' | 'based-on';

export interface Meaning {
  content: string;
  confidence: number;
  timestamp: number;
}

export interface Relationship {
  type: RelationType;
  target: NodeId;
  strength: number;
  gloss?: string;
}

export interface MetaphorBranch {
  name: string;
  interpretation: string;
  weight: number;
  predictiveSuccess: number;
}

export class ThoughtNode {
  public id: NodeId;
  public meanings: Meaning[] = [];
  public values = new Map<string, number | Interval>();
  public relationships: Relationship[] = [];
  public metaphorBranches: MetaphorBranch[] = [];
  public tension?: string;
  public history: string[] = [];

  constructor(id: NodeId) {
    this.id = id;
    this.history.push(`Created node: ${id}`);
  }

  // Semantic layer (Claude's approach)
  means(content: string, confidence = 1.0): this {
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

  holdsTension(description: string): this {
    this.tension = description;
    this.history.push(`Tension: ${description}`);
    return this;
  }

  // Numerical layer (GPT-5's approach)
  hasValue(key: string, value: number | Interval): this {
    this.values.set(key, value);
    this.history.push(`Set ${key} = ${JSON.stringify(value)}`);
    return this;
  }

  // Metaphor forking - multiple interpretations in superposition
  forkMetaphor(name: string, interpretation: string, initialWeight = 1.0): this {
    this.metaphorBranches.push({
      name,
      interpretation,
      weight: initialWeight,
      predictiveSuccess: 0
    });
    this.history.push(`Forked metaphor: ${name}`);
    return this;
  }

  // Relationships with both semantic and causal aspects
  relatesTo(target: NodeId, type: RelationType, strength = 1.0, gloss?: string): this {
    this.relationships.push({ type, target, strength, gloss });
    this.history.push(`Related to ${target} via ${type} (${strength})`);
    return this;
  }

  // Current state accessors
  currentMeaning(): string {
    return this.meanings[this.meanings.length - 1]?.content || '[undefined]';
  }

  getValue(key: string): number | Interval | undefined {
    return this.values.get(key);
  }

  // History-aware transforms - impact changes with repetition
  applyHistoryAwareTransform(transformType: string, magnitude: number): this {
    const occurrences = this.history.filter(h => h.includes(transformType)).length;

    // First occurrence has full impact, subsequent ones diminish
    const adjustedMagnitude = magnitude / (1 + occurrences * 0.5);

    this.history.push(`Applied ${transformType} with adjusted magnitude: ${adjustedMagnitude}`);
    return this;
  }

  // Self-reference - node can observe itself
  observesSelf(observation: string): this {
    this.history.push(`Self-observation: ${observation}`);
    // Self-observation can modify the node's properties
    this.means(`Self-aware: ${observation}`, 0.8);
    return this;
  }

  // Provenance-first - full story of how we got here
  getProvenance(): string[] {
    return [...this.history];
  }
}

export class ThoughtSpace {
  private nodes = new Map<NodeId, ThoughtNode>();
  private globalHistory: string[] = [];
  private listeners: Array<(space: ThoughtSpace) => void> = [];

  // Create or retrieve a node
  thought(id: NodeId): ThoughtNode {
    if (!this.nodes.has(id)) {
      const node = new ThoughtNode(id);
      this.nodes.set(id, node);
      this.globalHistory.push(`Created thought: ${id}`);
      this.notifyListeners();
    }
    return this.nodes.get(id)!;
  }

  // Contextual collapse - system reads its own patterns to decide which metaphor to trust
  collapseMetaphor(nodeId: NodeId, context: string): string | null {
    const node = this.nodes.get(nodeId);
    if (!node || node.metaphorBranches.length === 0) return null;

    // Simple heuristic: choose metaphor based on context and past success
    let bestBranch = node.metaphorBranches[0];
    let bestScore = 0;

    for (const branch of node.metaphorBranches) {
      // Score based on predictive success and context relevance
      const contextRelevance = branch.interpretation.toLowerCase().includes(context.toLowerCase()) ? 2 : 1;
      const score = branch.predictiveSuccess * contextRelevance * branch.weight;

      if (score > bestScore) {
        bestScore = score;
        bestBranch = branch;
      }
    }

    this.globalHistory.push(`Collapsed ${nodeId} to metaphor: ${bestBranch.name} in context: ${context}`);
    this.notifyListeners();
    return bestBranch.interpretation;
  }

  // Propagate values through causal relationships
  propagate(fromId: NodeId, key: string): void {
    const fromNode = this.nodes.get(fromId);
    if (!fromNode) return;

    const value = fromNode.getValue(key);
    if (value === undefined) return;

    for (const rel of fromNode.relationships) {
      if (rel.type === 'causes') {
        const targetNode = this.nodes.get(rel.target);
        if (targetNode) {
          // Simple propagation - multiply by relationship strength
          let propagatedValue: number | Interval;
          if (typeof value === 'number') {
            propagatedValue = value * rel.strength;
          } else {
            propagatedValue = [value[0] * rel.strength, value[1] * rel.strength];
          }

          targetNode.hasValue(key, propagatedValue);
          this.globalHistory.push(`Propagated ${key} from ${fromId} to ${rel.target}`);
        }
      }
    }
    this.notifyListeners();
  }

  // Reflect on the current state of the system
  reflect(): string {
    const nodeCount = this.nodes.size;
    const totalMeanings = Array.from(this.nodes.values()).reduce((sum, node) => sum + node.meanings.length, 0);
    const totalRelationships = Array.from(this.nodes.values()).reduce((sum, node) => sum + node.relationships.length, 0);

    return `ThoughtSpace contains ${nodeCount} nodes, ${totalMeanings} meanings, ${totalRelationships} relationships`;
  }

  // Get all nodes for inspection
  getAllNodes(): Map<NodeId, ThoughtNode> {
    return new Map(this.nodes);
  }

  // Export current state
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

  // Subscribe to changes for real-time updates
  subscribe(listener: (space: ThoughtSpace) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this));
  }
}

export interface SessionMetadata {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

export class Session {
  public metadata: SessionMetadata;
  private thoughtSpace: ThoughtSpace;

  constructor(id: string, title: string, description: string) {
    this.metadata = {
      id,
      title,
      description,
      createdAt: Date.now()
    };
    this.thoughtSpace = new ThoughtSpace();
  }

  // Clean API: create/retrieve thoughts and auto-register them
  thought(id: NodeId): ThoughtNode {
    return this.thoughtSpace.thought(id);
  }

  // Delegate ThoughtSpace methods
  collapseMetaphor(nodeId: NodeId, context: string): string | null {
    return this.thoughtSpace.collapseMetaphor(nodeId, context);
  }

  propagate(fromId: NodeId, key: string): void {
    this.thoughtSpace.propagate(fromId, key);
  }

  reflect(): string {
    return this.thoughtSpace.reflect();
  }

  getAllNodes(): Map<NodeId, ThoughtNode> {
    return this.thoughtSpace.getAllNodes();
  }

  // Subscribe to changes for real-time updates
  subscribe(listener: (space: ThoughtSpace) => void): () => void {
    return this.thoughtSpace.subscribe(listener);
  }

  // Self-serialization: complete JSON including metadata and all thoughts
  serialize(): object {
    const thoughtSpaceData = this.thoughtSpace.serialize();

    return {
      metadata: this.metadata,
      thoughtSpace: thoughtSpaceData
    };
  }
}

// Create a default space for shared use
export const globalThoughtSpace = new ThoughtSpace();
export const thought = (id: NodeId) => globalThoughtSpace.thought(id);