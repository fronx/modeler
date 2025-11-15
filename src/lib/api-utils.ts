import { NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';
import type { CognitiveSpace } from '@/lib/turso-graph';

export const db = () => createDatabase();

export async function broadcast(spaceId: string) {
  const ws = getThoughtWebSocketServer();
  ws?.broadcastSpaceUpdate(spaceId).catch(console.error);
}

export async function broadcastSpaceList() {
  const ws = getThoughtWebSocketServer();
  await ws?.broadcastSpaceList();
}

export async function saveSpace(space: CognitiveSpace) {
  await db().insertSpace(space);

  const ws = getThoughtWebSocketServer();

  // Notify UI that a new space was created (triggers auto-switch)
  ws?.broadcastSpaceCreated(space.metadata.id);

  // Broadcast empty thoughts for the new space
  await broadcast(space.metadata.id);

  // Update the space list
  await broadcastSpaceList();
}

export const ok = (data: any) => NextResponse.json(data);
export const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });
