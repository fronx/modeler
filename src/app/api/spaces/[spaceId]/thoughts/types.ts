export interface ThoughtsListResponse {
  nodes: Record<string, any>;
  spaceId: string;
  loadedAt: string;
  count: number;
}

export interface CreateThoughtResponse {
  success: boolean;
  message: string;
  thoughtId: string;
  spaceId: string;
}

export interface DeleteThoughtResponse {
  success: boolean;
  message: string;
  nodeId: string;
  spaceId: string;
}
