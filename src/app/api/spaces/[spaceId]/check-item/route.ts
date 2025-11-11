import { db, saveSpace, ok, err } from '@/lib/api-utils';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { nodeId, itemIndex, checked } = await request.json();

    if (typeof nodeId !== 'string' || typeof itemIndex !== 'number' || typeof checked !== 'boolean') {
      return err('Invalid request. Required: nodeId (string), itemIndex (number), checked (boolean)', 400);
    }

    const space = await db().getSpace(spaceId);
    if (!space) {
      return err('Space not found', 404);
    }

    const node = space.nodes[nodeId];
    if (!node) {
      return err('Node not found', 404);
    }

    if (!node.checkableList || !Array.isArray(node.checkableList)) {
      return err('Node does not have a checkable list', 400);
    }

    if (itemIndex < 0 || itemIndex >= node.checkableList.length) {
      return err('Item index out of bounds', 400);
    }

    node.checkableList[itemIndex].checked = checked;

    await saveSpace(space);

    return ok({
      success: true,
      item: node.checkableList[itemIndex],
      nodeId,
      itemIndex,
      checked
    });

  } catch (error) {
    console.error('Failed to update item:', error);
    return err('Failed to update item', 500);
  }
}