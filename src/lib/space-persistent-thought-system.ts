/**
 * Space-based persistent thought system
 * Thoughts are stored in space-specific directories
 */

import fs from 'fs/promises';
import path from 'path';
import { ThoughtSpace, ThoughtNode, type NodeId } from './thought-system';

export class SpacePersistentThoughtSpace extends ThoughtSpace {
  private spaceId: string;
  private dataDir: string;
  private writeQueue = new Map<NodeId, Promise<void>>();

  constructor(spaceId: string) {
    super();
    this.spaceId = spaceId;
    this.dataDir = path.join('data/spaces', spaceId);
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getNodeFilePath(nodeId: NodeId): string {
    // Sanitize node ID for filename
    const safeId = nodeId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `${safeId}.json`);
  }

  // Override thought creation to auto-persist
  thought(id: NodeId): ThoughtNode {
    const node = super.thought(id);

    // Wrap node methods to auto-save after modifications
    const originalMeans = node.means.bind(node);
    const originalBecomes = node.becomes.bind(node);
    const originalHoldsTension = node.holdsTension.bind(node);
    const originalHasValue = node.hasValue.bind(node);
    const originalForkMetaphor = node.forkMetaphor.bind(node);
    const originalRelatesTo = node.relatesTo.bind(node);
    const originalObservesSelf = node.observesSelf.bind(node);

    node.means = (content: string, confidence = 1.0) => {
      const result = originalMeans(content, confidence);
      this.persistNode(node);
      return result;
    };

    node.becomes = (newMeaning: string) => {
      const result = originalBecomes(newMeaning);
      this.persistNode(node);
      return result;
    };

    node.holdsTension = (description: string) => {
      const result = originalHoldsTension(description);
      this.persistNode(node);
      return result;
    };

    node.hasValue = (key: string, value: number | [number, number]) => {
      const result = originalHasValue(key, value);
      this.persistNode(node);
      return result;
    };

    node.forkMetaphor = (name: string, interpretation: string, initialWeight = 1.0) => {
      const result = originalForkMetaphor(name, interpretation, initialWeight);
      this.persistNode(node);
      return result;
    };

    node.relatesTo = (target: NodeId, type: any, strength = 1.0, gloss?: string) => {
      const result = originalRelatesTo(target, type, strength, gloss);
      this.persistNode(node);
      return result;
    };

    node.observesSelf = (observation: string) => {
      const result = originalObservesSelf(observation);
      this.persistNode(node);
      return result;
    };

    return node;
  }

  private async persistNode(node: ThoughtNode): Promise<void> {
    const nodeId = node.id;

    // If a write is already in progress for this node, wait for it to complete
    const existingWrite = this.writeQueue.get(nodeId);
    if (existingWrite) {
      await existingWrite;
    }

    // Create a new write operation
    const writePromise = this.performWrite(node);
    this.writeQueue.set(nodeId, writePromise);

    try {
      await writePromise;
      // Update space metadata
      await this.updateSpaceMetadata();
    } finally {
      this.writeQueue.delete(nodeId);
    }
  }

  private async performWrite(node: ThoughtNode): Promise<void> {
    try {
      const filePath = this.getNodeFilePath(node.id);
      const nodeData = {
        id: node.id,
        meanings: node.meanings,
        values: Object.fromEntries(node.values),
        relationships: node.relationships,
        metaphorBranches: node.metaphorBranches,
        tension: node.tension,
        history: node.history,
        lastModified: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(nodeData, null, 2));
    } catch (error) {
      console.error(`Failed to persist node ${node.id}:`, error);
    }
  }

  private async updateSpaceMetadata(): Promise<void> {
    try {
      const metaPath = path.join(this.dataDir, '_space.json');
      let spaceMeta;

      try {
        const content = await fs.readFile(metaPath, 'utf-8');
        spaceMeta = JSON.parse(content);
      } catch {
        // Create new metadata if it doesn't exist
        spaceMeta = {
          id: this.spaceId,
          title: `Space ${this.spaceId}`,
          description: 'Cognitive modeling space',
          created: new Date().toISOString()
        };
      }

      // Update metadata
      spaceMeta.lastModified = new Date().toISOString();
      spaceMeta.thoughtCount = this.getAllNodes().size;

      await fs.writeFile(metaPath, JSON.stringify(spaceMeta, null, 2));
    } catch (error) {
      console.error('Failed to update space metadata:', error);
    }
  }
}

// Factory function to create space-aware thought spaces
export function createSpaceThoughtSpace(spaceId: string): {
  space: SpacePersistentThoughtSpace;
  thought: (id: NodeId) => ThoughtNode;
} {
  const space = new SpacePersistentThoughtSpace(spaceId);
  const thought = (id: NodeId) => space.thought(id);
  return { space, thought };
}