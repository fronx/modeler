import { NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer, WEBSOCKET_PORT } from '@/lib/websocket-server';
import type { CognitiveSpace } from '@/lib/turso-graph';

export const db = () => createDatabase();

/**
 * Broadcast space update to WebSocket clients
 * Tries HTTP API first (for cross-process communication from MCP server)
 * Falls back to direct call if we're in the same process
 */
export async function broadcast(spaceId: string) {
  // Try HTTP API first (for MCP server -> Next.js communication)
  try {
    const response = await fetch(`http://localhost:${WEBSOCKET_PORT}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'space_update', spaceId }),
    });

    if (response.ok) {
      return; // Success via HTTP
    }
  } catch (error) {
    // HTTP failed, fall back to direct call
  }

  // Fallback: direct call if we're in the same process
  const ws = getThoughtWebSocketServer();
  if (ws) {
    await ws.broadcastSpaceUpdate(spaceId).catch(console.error);
  }
}

/**
 * Broadcast space list update to WebSocket clients
 * Tries HTTP API first (for cross-process communication from MCP server)
 * Falls back to direct call if we're in the same process
 */
export async function broadcastSpaceList() {
  // Try HTTP API first (for MCP server -> Next.js communication)
  try {
    const response = await fetch(`http://localhost:${WEBSOCKET_PORT}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'space_list' }),
    });

    if (response.ok) {
      return; // Success via HTTP
    }
  } catch (error) {
    // HTTP failed, fall back to direct call
  }

  // Fallback: direct call if we're in the same process
  const ws = getThoughtWebSocketServer();
  if (ws) {
    await ws.broadcastSpaceList();
  }
}

export async function saveSpace(space: CognitiveSpace) {
  await db().insertSpace(space);

  // Try HTTP API first for cross-process communication
  try {
    const response = await fetch(`http://localhost:${WEBSOCKET_PORT}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'space_created', spaceId: space.metadata.id }),
    });

    if (response.ok) {
      return; // Success via HTTP (handles space_created, space_update, and space_list)
    }
  } catch (error) {
    // HTTP failed, fall back to direct call
  }

  // Fallback: direct call if we're in the same process
  const ws = getThoughtWebSocketServer();
  if (ws) {
    ws.broadcastSpaceCreated(space.metadata.id);
    await broadcast(space.metadata.id);
    await broadcastSpaceList();
  }
}

/**
 * Process raw node data into normalized node structure with defaults
 * Shared by API endpoint and MCP server
 */
export function processNodeData(nodeData: any) {
  if (!nodeData.id) {
    throw new Error('Node ID required');
  }

  const now = Date.now();
  const processedMeanings = (nodeData.meanings || []).map((meaning: any) => ({
    ...meaning,
    timestamp: meaning.timestamp ?? now
  }));

  return {
    id: nodeData.id,
    meanings: processedMeanings,
    values: nodeData.values || {},
    relationships: nodeData.relationships || [],
    resolutions: nodeData.resolutions || [],
    focus: nodeData.focus !== undefined ? nodeData.focus : 0.0,
    semanticPosition: nodeData.semanticPosition !== undefined ? nodeData.semanticPosition : 0.0,
    history: nodeData.history || [`Created node: ${nodeData.id}`],
    ...(nodeData.branches && { branches: nodeData.branches }),
    ...(nodeData.tension && { tension: nodeData.tension }),
    ...(nodeData.regularList && { regularList: nodeData.regularList }),
    ...(nodeData.checkableList && { checkableList: nodeData.checkableList })
  };
}

/**
 * Create or update a node in a space with proper validation and broadcasting
 * Shared by API endpoint and MCP server
 */
export async function upsertNode(spaceId: string, nodeData: any) {
  // Verify space exists
  const existingSpace = await db().getSpace(spaceId);
  if (!existingSpace) {
    throw new Error(`Space not found: ${spaceId}`);
  }

  // Process node data (validates ID, adds defaults)
  const processedNode = processNodeData(nodeData);

  // Use granular node upsert instead of rewriting entire space
  await db().upsertNode(spaceId, nodeData.id, processedNode);

  // Trigger WebSocket broadcast for UI update
  await broadcast(spaceId);

  return processedNode;
}

/**
 * Delete a node from a space with proper validation and broadcasting
 * Shared by API endpoint and MCP server
 */
export async function deleteNode(spaceId: string, nodeId: string) {
  const deleted = await db().deleteNode(spaceId, nodeId);

  if (!deleted) {
    throw new Error(`Node not found: ${nodeId} in space ${spaceId}`);
  }

  // Trigger WebSocket broadcast for UI update
  await broadcast(spaceId);

  return true;
}

/**
 * Create an edge between two nodes with proper validation and broadcasting
 * Shared by API endpoint and MCP server
 */
export async function createEdge(
  spaceId: string,
  sourceNode: string,
  targetNode: string,
  type: string,
  strength?: number,
  gloss?: string
) {
  // Insert edge
  await db().insertEdge({
    spaceId,
    sourceNode,
    targetNode,
    type,
    strength: strength ?? 0.7,
    gloss
  });

  // Broadcast update to UI
  await broadcast(spaceId);

  return true;
}

/**
 * Delete an edge with proper validation and broadcasting
 * Shared by API endpoint and MCP server
 */
export async function deleteEdge(spaceId: string, edgeId: string) {
  const deleted = await db().deleteEdge(edgeId);

  if (!deleted) {
    throw new Error(`Edge not found: ${edgeId}`);
  }

  // Broadcast update to UI
  await broadcast(spaceId);

  return true;
}

export const ok = (data: any) => NextResponse.json(data);
export const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
