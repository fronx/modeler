#!/usr/bin/env node
/**
 * Cognitive Space CLI - Command-line interface for working with cognitive spaces
 *
 * This tool provides a comprehensive interface for Claude Code to interact with
 * cognitive spaces autonomously, supporting the complete /modeler workflow.
 *
 * Spaces can be referenced by either ID or title throughout all commands.
 */

import { Command } from 'commander';
import { createDatabase } from '../src/lib/database-factory';
import type { CognitiveSpace } from '../src/lib/database';

const program = new Command();

let debugMode = false;

program
  .name('space-cli')
  .description('Cognitive Space CLI - Command-line interface for cognitive modeling')
  .version('1.0.0')
  .option('-d, --debug', 'Enable debug output')
  .hook('preAction', (thisCommand) => {
    debugMode = thisCommand.opts().debug || false;
  });

// Utility function for consistent output
function output(data: any, debugData?: any) {
  console.log(JSON.stringify(debugMode && debugData ? debugData : data, null, 2));
}

// Resolve space identifier (ID or title) to actual space
async function resolveSpace(identifier: string): Promise<CognitiveSpace | null> {
  const db = createDatabase();
  try {
    // Try as ID first
    let space = await db.getSpace(identifier);
    if (space) return space;

    // Try as title - search all spaces
    const allSpaces = await db.listSpaces();
    const matchingSpace = allSpaces.find(s => s.title === identifier);
    if (matchingSpace) {
      space = await db.getSpace(matchingSpace.id);
      return space;
    }

    return null;
  } finally {
    await db.close();
  }
}

// ============================================================================
// List Spaces
// ============================================================================
program
  .command('list')
  .description('List all cognitive spaces')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const db = createDatabase();
    try {
      const spaces = await db.listSpaces();

      if (options.json) {
        console.log(JSON.stringify(spaces, null, 2));
      } else {
        for (const space of spaces) {
          console.log(`${space.id} | ${space.title} | ${space.nodeCount} nodes`);
        }
      }
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Create Space
// ============================================================================
program
  .command('create')
  .description('Create a new cognitive space')
  .argument('<title>', 'Space title')
  .argument('[description]', 'Space description', '')
  .action(async (title: string, description: string) => {
    const db = createDatabase();
    try {
      const spaceId = new Date().toISOString().replace(/[:.]/g, '-');
      const newSpace: CognitiveSpace = {
        metadata: {
          id: spaceId,
          title,
          description,
          createdAt: Date.now()
        },
        nodes: {},
        globalHistory: [`Space created: ${new Date().toISOString()}`]
      };

      await db.insertSpace(newSpace);

      output({ id: spaceId });
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Get Space
// ============================================================================
program
  .command('get')
  .description('Get full space JSON')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .option('--nodes-only', 'Return only the nodes')
  .action(async (spaceIdentifier: string, options: { nodesOnly?: boolean }) => {
    const space = await resolveSpace(spaceIdentifier);

    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    if (options.nodesOnly) {
      console.log(JSON.stringify(space.nodes, null, 2));
    } else {
      console.log(JSON.stringify(space, null, 2));
    }
  });

// ============================================================================
// Analyze Space
// ============================================================================
program
  .command('analyze')
  .description('Analyze space structure (focus levels, relationships, branches)')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .action(async (spaceIdentifier: string) => {
    const space = await resolveSpace(spaceIdentifier);

    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    // Analyze focus levels
    const focusLevels: Record<string, string[]> = {
      visible: [],
      neutral: [],
      hidden: []
    };

    const relationships: Array<{from: string, to: string, type: string, strength: number}> = [];
    const branchedNodes: string[] = [];

    for (const [nodeKey, nodeData] of Object.entries(space.nodes)) {
      const focus = nodeData.focus ?? 0.0;
      if (focus > 0.5) {
        focusLevels.visible.push(nodeKey);
      } else if (focus < -0.5) {
        focusLevels.hidden.push(nodeKey);
      } else {
        focusLevels.neutral.push(nodeKey);
      }

      if (nodeData.relationships) {
        for (const rel of nodeData.relationships) {
          relationships.push({
            from: nodeKey,
            to: rel.target,
            type: rel.type,
            strength: rel.strength
          });
        }
      }

      if (nodeData.branches && Object.keys(nodeData.branches).length > 0) {
        branchedNodes.push(nodeKey);
      }
    }

    console.log(JSON.stringify({
      title: space.metadata.title,
      description: space.metadata.description,
      totalNodes: Object.keys(space.nodes).length,
      historyEntries: space.globalHistory.length,
      focusLevels,
      relationships,
      branchedNodes
    }, null, 2));
  });

// ============================================================================
// Add Node
// ============================================================================
program
  .command('add-node')
  .description('Add a new thought node to a space')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .requiredOption('-t, --title <text>', 'Node title (used to generate ID)')
  .option('--body <text>', 'Node body/content')
  .option('-c, --confidence <number>', 'Confidence level (0-1)', parseFloat, 0.9)
  .option('-f, --focus <number>', 'Focus level (-1=hidden, 0=neutral, 1=visible)', parseFloat, 1.0)
  .option('-p, --position <number>', 'Semantic position (-1 to 1)', parseFloat, 0.0)
  .option('-v, --values <json>', 'JSON object of values')
  .option('-r, --relates-to <nodeId:type:strength...>', 'Add relationships', collect, [])
  .option('--checkable <item...>', 'Add checkable list items', collect, [])
  .option('--regular <item...>', 'Add regular list items', collect, [])
  .option('-b, --branches <json>', 'Branches JSON object')
  .action(async (spaceIdentifier: string, options: any) => {
    const space = await resolveSpace(spaceIdentifier);
    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    const db = createDatabase();
    try {

      // Generate nodeId from title (PascalCase)
      const nodeId = options.title
        .split(/\s+/)
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');

      if (space.nodes[nodeId]) {
        console.error(`Node '${nodeId}' already exists (generated from title). Use update-node to modify.`);
        process.exit(1);
      }

      // Build meanings array from title and optional body
      const meanings = [];
      if (options.title) {
        meanings.push({
          content: options.title,
          confidence: options.confidence,
          timestamp: Date.now()
        });
      }
      if (options.body) {
        meanings.push({
          content: options.body,
          confidence: options.confidence,
          timestamp: Date.now()
        });
      }

      const relationships = options.relatesTo.map((rel: string) => {
        const [target, type, strengthStr] = rel.split(':');
        return {
          target,
          type: type || 'supports',
          strength: parseFloat(strengthStr) || 0.8
        };
      });

      const newNode: any = {
        meanings,
        values: options.values ? JSON.parse(options.values) : {},
        relationships,
        focus: options.focus,
        semanticPosition: options.position,
        history: [`Node created: ${new Date().toISOString()}`]
      };

      if (options.checkable.length > 0) {
        newNode.checkableList = options.checkable.map((item: string) => ({
          item,
          checked: false
        }));
      }

      if (options.regular.length > 0) {
        newNode.regularList = options.regular;
      }

      if (options.branches) {
        newNode.branches = JSON.parse(options.branches);
      }

      space.nodes[nodeId] = newNode;
      space.globalHistory.push(`Node added: ${nodeId}`);

      await db.insertSpace(space);

      output({ success: true, nodeId }, { spaceId: space.metadata.id, nodeId, node: newNode });
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Update Node
// ============================================================================
program
  .command('update-node')
  .description('Update an existing thought node')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .argument('<nodeId>', 'Node ID')
  .option('-m, --meaning <text>', 'Add new meaning')
  .option('-c, --confidence <number>', 'Confidence for new meaning', parseFloat, 0.9)
  .option('-f, --focus <number>', 'Update focus level', parseFloat)
  .option('-p, --position <number>', 'Update semantic position', parseFloat)
  .option('-v, --values <json>', 'Merge values (JSON)')
  .option('-r, --relates-to <nodeId:type:strength...>', 'Add relationships', collect, [])
  .option('--checkable <item...>', 'Add checkable list items', collect, [])
  .option('--regular <item...>', 'Add regular list items', collect, [])
  .action(async (spaceIdentifier: string, nodeId: string, options: any) => {
    const space = await resolveSpace(spaceIdentifier);
    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    if (!space.nodes[nodeId]) {
      console.error(`Node '${nodeId}' not found. Use add-node to create.`);
      process.exit(1);
    }

    const db = createDatabase();
    try {

      const node = space.nodes[nodeId];

      if (options.meaning) {
        node.meanings = node.meanings || [];
        node.meanings.push({
          content: options.meaning,
          confidence: options.confidence,
          timestamp: Date.now()
        });
      }

      if (options.focus !== undefined) node.focus = options.focus;
      if (options.position !== undefined) node.semanticPosition = options.position;

      if (options.values) {
        node.values = { ...node.values, ...JSON.parse(options.values) };
      }

      if (options.relatesTo.length > 0) {
        const newRels = options.relatesTo.map((rel: string) => {
          const [target, type, strengthStr] = rel.split(':');
          return {
            target,
            type: type || 'supports',
            strength: parseFloat(strengthStr) || 0.8
          };
        });
        node.relationships = [...(node.relationships || []), ...newRels];
      }

      if (options.checkable.length > 0) {
        node.checkableList = node.checkableList || [];
        options.checkable.forEach((item: string) => {
          node.checkableList.push({ item, checked: false });
        });
      }

      if (options.regular.length > 0) {
        node.regularList = node.regularList || [];
        node.regularList.push(...options.regular);
      }

      node.history = node.history || [];
      node.history.push(`Node updated: ${new Date().toISOString()}`);
      space.globalHistory.push(`Node updated: ${nodeId}`);

      await db.insertSpace(space);

      output({ success: true, nodeId }, { spaceId: space.metadata.id, nodeId, node });
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Patch Space
// ============================================================================
program
  .command('patch')
  .description('Apply raw JSON patch to a space')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .argument('<jsonPatch>', 'JSON patch object')
  .action(async (spaceIdentifier: string, jsonPatch: string) => {
    const space = await resolveSpace(spaceIdentifier);
    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    const db = createDatabase();
    try {

      const patch = JSON.parse(jsonPatch);

      if (patch.metadata) Object.assign(space.metadata, patch.metadata);

      if (patch.nodes) {
        for (const [nodeKey, nodeData] of Object.entries(patch.nodes)) {
          if (space.nodes[nodeKey]) {
            Object.assign(space.nodes[nodeKey], nodeData);
          } else {
            space.nodes[nodeKey] = nodeData as any;
          }
        }
      }

      if (patch.globalHistory) space.globalHistory.push(...patch.globalHistory);

      space.globalHistory.push(`Space patched: ${new Date().toISOString()}`);

      await db.insertSpace(space);

      output({ success: true, spaceId: space.metadata.id });
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Delete Space
// ============================================================================
program
  .command('delete')
  .description('Delete a cognitive space')
  .argument('<spaceIdentifier>', 'Space ID or title')
  .action(async (spaceIdentifier: string) => {
    const space = await resolveSpace(spaceIdentifier);
    if (!space) {
      console.error(`Space not found: ${spaceIdentifier}`);
      process.exit(1);
    }

    const db = createDatabase();
    try {
      await db.deleteSpace(space.metadata.id);
      output({ success: true, deleted: space.metadata.id });
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Search Spaces (Vector Search)
// ============================================================================
program
  .command('search')
  .description('Search for spaces semantically (requires vector search)')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum results', parseInt, 10)
  .action(async (query: string, options: { limit: number }) => {
    const db = createDatabase();

    if (!('searchSpaces' in db)) {
      console.error('Error: Vector search requires DATABASE_TYPE=turso');
      process.exit(1);
    }

    try {
      const results = await (db as any).searchSpaces(query, options.limit);
      output(results);
    } finally {
      await db.close();
    }
  });

// ============================================================================
// Search Nodes (Vector Search)
// ============================================================================
program
  .command('search-nodes')
  .description('Search for nodes semantically (requires vector search)')
  .argument('<query>', 'Search query')
  .option('-s, --space <spaceId>', 'Limit to specific space')
  .option('-l, --limit <number>', 'Maximum results', parseInt, 10)
  .action(async (query: string, options: { space?: string; limit: number }) => {
    const db = createDatabase();

    if (!('searchAllNodes' in db) && !('searchNodesInSpace' in db)) {
      console.error('Error: Vector search requires DATABASE_TYPE=turso');
      process.exit(1);
    }

    try {
      const results = options.space
        ? await (db as any).searchNodesInSpace(options.space, query, options.limit)
        : await (db as any).searchAllNodes(query, options.limit);

      output(results);
    } finally {
      await db.close();
    }
  });

// Helper function for collecting repeated options
function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

program.parse();
