export interface Edge {
  id: string;
  sourceNode: string;
  targetNode: string;
  type: string;
  strength: number;
  gloss?: string;
}

export interface EdgesListResponse {
  edges: Edge[];
  spaceId: string;
  loadedAt: string;
  count: number;
}

export interface MutateEdgeResponse {
  success: boolean;
  message: string;
}
