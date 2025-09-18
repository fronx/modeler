import { ThoughtNode } from '../thought-system';

export interface ThoughtSpaceData {
  thoughtSpace?: any;
  nodes?: Record<string, any>;
  metadata?: any;
  globalHistory?: string[];
}

class ThoughtsApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ThoughtsApiError';
  }
}

export const thoughtsApi = {
  async getSpaceThoughts(spaceId: string): Promise<ThoughtSpaceData> {
    try {
      const response = await fetch(`/api/spaces/${spaceId}/thoughts-direct`);
      if (!response.ok) {
        throw new ThoughtsApiError(`Failed to load space thoughts: ${response.status}`, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ThoughtsApiError) throw error;
      throw new ThoughtsApiError('Network error while fetching space thoughts');
    }
  },

  parseThoughtData(data: ThoughtSpaceData): Map<string, ThoughtNode> {
    // Handle both new Space structure and old format
    const thoughtSpaceData = data.thoughtSpace || data;
    const nodesData = thoughtSpaceData.nodes || data.nodes || {};

    const nodeMap = new Map<string, ThoughtNode>();

    // Convert serialized data back to ThoughtNode instances
    for (const [id, nodeData] of Object.entries(nodesData)) {
      const node = new ThoughtNode(id);
      const typedNodeData = nodeData as any;

      node.meanings = typedNodeData.meanings || [];
      node.values.clear();
      for (const [key, value] of Object.entries(typedNodeData.values || {})) {
        node.values.set(key, value as any);
      }
      node.relationships = typedNodeData.relationships || [];
      node.metaphorBranches = typedNodeData.metaphorBranches || [];

      // Convert branches from object to Map
      node.branches = new Map();
      if (typedNodeData.branches) {
        for (const [branchName, branchData] of Object.entries(typedNodeData.branches)) {
          const branch = branchData as any;
          const branchValues = new Map();
          for (const [key, value] of Object.entries(branch.values || {})) {
            branchValues.set(key, value);
          }
          node.branches.set(branchName, {
            name: branch.name,
            interpretation: branch.interpretation,
            relationships: branch.relationships || [],
            values: branchValues,
            isActive: branch.isActive !== undefined ? branch.isActive : true
          });
        }
      }

      node.resolutions = typedNodeData.resolutions || [];
      node.tension = typedNodeData.tension;
      node.focus = typedNodeData.focus || 0.1;
      node.semanticPosition = typedNodeData.semanticPosition || 0.0;
      node.history = typedNodeData.history || [];

      // List properties - handle both old and new formats
      if (typedNodeData.regularList) {
        if (Array.isArray(typedNodeData.regularList)) {
          node.regularList = typedNodeData.regularList;
        } else if (typeof typedNodeData.regularList === 'object' && typedNodeData.regularList.items) {
          node.regularList = typedNodeData.regularList.items;
        }
      }

      if (typedNodeData.checkableList) {
        if (Array.isArray(typedNodeData.checkableList)) {
          node.checkableList = typedNodeData.checkableList;
        } else if (typeof typedNodeData.checkableList === 'object' && typedNodeData.checkableList.items) {
          node.checkableList = typedNodeData.checkableList.items;
        }
      }

      nodeMap.set(id, node);
    }

    return nodeMap;
  }
};