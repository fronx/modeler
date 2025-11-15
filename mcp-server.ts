#!/usr/bin/env node

/**
 * MCP Server for Cognitive Space API
 *
 * Exposes cognitive space operations as MCP tools and resources
 * for seamless integration with Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createDatabase } from './src/lib/database-factory.js';

const BASE_URL = process.env.MODELER_URL || 'http://localhost:3000';

// Initialize database
const db = createDatabase();

// Create MCP server
const server = new Server(
  {
    name: 'cognitive-space-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================================
// TOOLS - Operations on cognitive spaces
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_space',
        description: 'Create a new cognitive space with title and description',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Space title (human-readable)',
            },
            description: {
              type: 'string',
              description: 'What this space explores',
            },
          },
          required: ['title', 'description'],
        },
      },
      {
        name: 'create_node',
        description: 'Create a thought node in a cognitive space',
        inputSchema: {
          type: 'object',
          properties: {
            spaceId: {
              type: 'string',
              description: 'ID of the space to add the node to',
            },
            id: {
              type: 'string',
              description: 'Node identifier (use natural spacing, not CamelCase)',
            },
            meanings: {
              type: 'array',
              description: 'Semantic meanings with confidence levels',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['content', 'confidence'],
              },
            },
            focus: {
              type: 'number',
              description: 'Visibility: 1.0=visible, 0.0=neutral, -1.0=hidden',
              minimum: -1,
              maximum: 1,
            },
            semanticPosition: {
              type: 'number',
              description: 'Position: -1.0=left, 0.0=center, 1.0=right',
              minimum: -1,
              maximum: 1,
            },
            values: {
              type: 'object',
              description: 'Key-value properties',
              additionalProperties: true,
            },
            relationships: {
              type: 'array',
              description: 'Relationships to other nodes',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  target: { type: 'string' },
                  strength: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['type', 'target', 'strength'],
              },
            },
            checkableList: {
              type: 'array',
              description: 'Checklist items',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  checked: { type: 'boolean' },
                },
                required: ['item', 'checked'],
              },
            },
            regularList: {
              type: 'array',
              description: 'Regular list items',
              items: { type: 'string' },
            },
          },
          required: ['spaceId', 'id'],
        },
      },
      {
        name: 'delete_node',
        description: 'Delete a thought node from a cognitive space',
        inputSchema: {
          type: 'object',
          properties: {
            spaceId: {
              type: 'string',
              description: 'ID of the space containing the node',
            },
            nodeId: {
              type: 'string',
              description: 'ID of the node to delete',
            },
          },
          required: ['spaceId', 'nodeId'],
        },
      },
      {
        name: 'list_spaces',
        description: 'List all cognitive spaces',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_space',
        description: 'Get full details of a cognitive space',
        inputSchema: {
          type: 'object',
          properties: {
            spaceId: {
              type: 'string',
              description: 'ID of the space to retrieve',
            },
          },
          required: ['spaceId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_space': {
        const { title, description } = args as { title: string; description: string };

        const response = await fetch(`${BASE_URL}/api/spaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to create space: ${JSON.stringify(result)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `✓ Created space: ${result.space.metadata.title}\n  ID: ${result.space.metadata.id}\n  View at: http://localhost:3000/?space=${result.space.metadata.id}`,
            },
          ],
        };
      }

      case 'create_node': {
        const { spaceId, ...nodeData } = args as any;

        const response = await fetch(`${BASE_URL}/api/spaces/${spaceId}/thoughts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodeData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to create node: ${JSON.stringify(result)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `✓ Created node: ${nodeData.id}\n  Space: ${spaceId}\n  Dashboard updated via WebSocket`,
            },
          ],
        };
      }

      case 'delete_node': {
        const { spaceId, nodeId } = args as { spaceId: string; nodeId: string };

        const response = await fetch(`${BASE_URL}/api/spaces/${spaceId}/thoughts/${nodeId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to delete node: ${JSON.stringify(result)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `✓ Deleted node: ${nodeId}\n  Space: ${spaceId}`,
            },
          ],
        };
      }

      case 'list_spaces': {
        const response = await fetch(`${BASE_URL}/api/spaces`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to list spaces: ${JSON.stringify(result)}`);
        }

        const spaceList = result.spaces
          .map((s: any) => `- ${s.title} (${s.id})`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Cognitive Spaces (${result.count}):\n${spaceList}`,
            },
          ],
        };
      }

      case 'get_space': {
        const { spaceId } = args as { spaceId: string };

        const response = await fetch(`${BASE_URL}/api/spaces/${spaceId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to get space: ${JSON.stringify(result)}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// RESOURCES - Cognitive spaces as browsable resources
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const spaces = await db.listSpaces();

    return {
      resources: spaces.map((space) => ({
        uri: `cognitive-space:///${space.id}`,
        name: space.title,
        description: space.description,
        mimeType: 'application/json',
      })),
    };
  } catch (error) {
    console.error('Failed to list resources:', error);
    return { resources: [] };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^cognitive-space:\/\/\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const spaceId = match[1];

  try {
    const space = await db.getSpace(spaceId);

    if (!space) {
      throw new Error(`Space not found: ${spaceId}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(space, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// ============================================================================
// START SERVER
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Cognitive Space MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
