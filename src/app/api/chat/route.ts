/**
 * Chat API endpoint for LLM interactions
 * Supports streaming responses and cognitive space context
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createDatabase } from '@/lib/database-factory';

const MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

// Lazy-load OpenAI client to avoid initialization errors when API key is not set
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL,
  });
}

// Load system prompt from modeler.md command file
const SYSTEM_PROMPT = (() => {
  try {
    const modelerMd = readFileSync(
      join(process.cwd(), '.claude/commands/modeler.md'),
      'utf-8'
    );

    const contextNote = `# Chat Interface Context

You are working in the Modeler web chat interface, NOT the CLI. Your capabilities differ from the CLI instructions below:

**Your Available Tools** (via function calling):
- add_node: Add a new thought node to the current space
- add_relationship: Add a relationship between two nodes

**You CANNOT use**:
- CLI commands (npx tsx scripts/space-cli.ts)
- Direct file system operations
- Bash commands

When users ask you to modify the space, use the function calling tools provided. The CLI instructions below are for reference to understand the cognitive modeling concepts and principles, but use function calling instead of CLI commands to implement changes.

---

`;

    return contextNote + modelerMd;
  } catch (error) {
    console.error('Failed to load modeler.md:', error);
    throw new Error('System prompt configuration error');
  }
})();

// Tool definitions for OpenAI tools API (supports streaming)
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_node',
      description: 'Add a new thought node to the current cognitive space',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the node (PascalCase, e.g., "UserPrivacy")',
          },
          meaning: {
            type: 'string',
            description: 'The main meaning or description of this thought',
          },
          focus: {
            type: 'number',
            description: 'Focus level: 1.0 (visible), 0.0 (neutral), -1.0 (background context)',
            default: 1.0,
          },
          position: {
            type: 'number',
            description: 'Semantic position from -1.0 (left) to 1.0 (right)',
            default: 0.0,
          },
        },
        required: ['id', 'meaning'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_relationship',
      description: 'Add a relationship between two nodes in the current space',
      parameters: {
        type: 'object',
        properties: {
          sourceNode: {
            type: 'string',
            description: 'ID of the source node',
          },
          targetNode: {
            type: 'string',
            description: 'ID of the target node',
          },
          type: {
            type: 'string',
            enum: ['supports', 'conflicts-with', 'relates-to'],
            description: 'Type of relationship',
          },
          strength: {
            type: 'number',
            description: 'Strength of the relationship (0.0 to 1.0)',
            default: 0.7,
          },
        },
        required: ['sourceNode', 'targetNode', 'type'],
      },
    },
  },
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, spaceId, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if API key is configured and get client
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        {
          error: 'LLM API key not configured',
          hint: 'Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment'
        },
        { status: 500 }
      );
    }

    // Build context from current space if provided
    let spaceContext = '';
    if (spaceId) {
      const db = createDatabase();
      try {
        const spaceData = await db.getSpace(spaceId);

        if (spaceData) {
          const nodeCount = Object.keys(spaceData.nodes).length;

          // Include node details with meanings
          const nodeDetails = Object.entries(spaceData.nodes).map(([key, node]: [string, any]) => {
            const meaning = node.meanings?.[0]?.content || 'No description';
            return `  - ${key}: ${meaning}`;
          }).join('\n');

          spaceContext = `\n\nCurrent Space Context:
- Space: "${spaceData.metadata.title}"
- Description: ${spaceData.metadata.description}
- Total Nodes: ${nodeCount}

Nodes in this space:
${nodeDetails}`;
        }
      } catch (error) {
        console.error('Failed to fetch space context:', error);
      }
      // Don't close database - it's a singleton
    }

    // Build messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + spaceContext },
      ...history,
      { role: 'user', content: message }
    ];

    // Always use streaming with tools API (supports both text and function calls)
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      tools: spaceId ? TOOLS : undefined, // Only enable tools if we have a space context
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let assistantContent = '';
          let toolCalls: any[] = [];

          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;

            // Handle text content
            if (delta?.content) {
              assistantContent += delta.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.index !== undefined) {
                  if (!toolCalls[toolCall.index]) {
                    toolCalls[toolCall.index] = {
                      id: toolCall.id || '',
                      type: 'function',
                      function: { name: '', arguments: '' }
                    };
                  }

                  if (toolCall.function?.name) {
                    toolCalls[toolCall.index].function.name = toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          }

          // If there were tool calls, send them all as proposed changes
          for (const toolCall of toolCalls) {
            if (toolCall.function.name && toolCall.function.arguments) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                proposedChange: {
                  function: toolCall.function.name,
                  arguments: JSON.parse(toolCall.function.arguments),
                  spaceId: spaceId,
                }
              })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check API status
export async function GET() {
  const isConfigured = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

  return NextResponse.json({
    status: isConfigured ? 'ready' : 'not_configured',
    model: MODEL,
    provider: process.env.OPENAI_API_KEY ? 'OpenAI' : process.env.ANTHROPIC_API_KEY ? 'Anthropic' : 'None',
  });
}
