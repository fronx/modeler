/**
 * Execute verified chat function calls (add nodes, relationships, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single and batch changes
    const isBatch = body.changes && Array.isArray(body.changes);
    const changes = isBatch ? body.changes : [{ function: body.function, arguments: body.arguments, spaceId: body.spaceId }];
    const spaceId = isBatch ? body.spaceId : body.spaceId;

    if (!spaceId || changes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const db = createDatabase();

    // Verify space exists
    const existingSpace = await db.getSpace(spaceId);
    if (!existingSpace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const results = [];

    // Process each change using granular updates
    for (const change of changes) {
      const { function: functionName, arguments: args } = change;

      switch (functionName) {
        case 'add_node': {
          const { id, meaning, focus = 1.0, position = 0.0 } = args;

          // Check if node already exists
          if (existingSpace.nodes[id]) {
            return NextResponse.json(
              { error: `Node '${id}' already exists` },
              { status: 400 }
            );
          }

          // Create new node
          const newNode = {
            meanings: [
              {
                content: meaning,
                confidence: 0.9,
                timestamp: Date.now(),
              },
            ],
            values: {},
            relationships: [],
            resolutions: [],
            focus,
            semanticPosition: position,
            history: [`Created via AI chat: ${new Date().toISOString()}`],
          };

          // Use granular upsert
          await db.upsertNode(spaceId, id, newNode);

          // Add to global history
          await db.appendGlobalHistory(spaceId, `AI added node: ${id}`);

          // Update local reference for validation in subsequent changes
          existingSpace.nodes[id] = newNode;

          results.push({ nodeId: id, action: 'created' });
          break;
        }

        case 'add_relationship': {
          const { sourceNode, targetNode, type, strength = 0.7 } = args;

          // Validate nodes exist
          if (!existingSpace.nodes[sourceNode]) {
            return NextResponse.json(
              { error: `Source node '${sourceNode}' not found` },
              { status: 400 }
            );
          }
          if (!existingSpace.nodes[targetNode]) {
            return NextResponse.json(
              { error: `Target node '${targetNode}' not found` },
              { status: 400 }
            );
          }

          // Add relationship to source node
          const sourceNodeData = existingSpace.nodes[sourceNode];
          if (!sourceNodeData.relationships) {
            sourceNodeData.relationships = [];
          }

          sourceNodeData.relationships.push({
            type,
            target: targetNode,
            strength,
          });

          // Use granular upsert
          await db.upsertNode(spaceId, sourceNode, sourceNodeData);

          // Add to global history
          await db.appendGlobalHistory(
            spaceId,
            `AI added relationship: ${sourceNode} ${type} ${targetNode}`
          );

          results.push({ sourceNode, targetNode, type, action: 'relationship_added' });
          break;
        }

        default:
          return NextResponse.json(
            { error: `Unknown function: ${functionName}` },
            { status: 400 }
          );
      }
    }

    // Trigger WebSocket broadcast
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(spaceId);
    }

    return NextResponse.json({
      success: true,
      results,
      message: isBatch
        ? `Successfully executed ${results.length} changes`
        : 'Change executed successfully',
    });
  } catch (error: any) {
    console.error('Execute function error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute function',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
