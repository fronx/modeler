import type { CognitiveSpace } from '@/lib/turso-database-0';

/** Flattened/formatted space summary as returned by GET /api/spaces */
export interface Space {
  id: string;
  title: string;
  description: string;
  created: string;
  lastModified: string;
  thoughtCount: number;
  path: string;
}

export interface SpacesListResponse {
  spaces: Space[];
  count: number;
}

export interface CreateSpaceResponse {
  space: Space;
  message: string;
}

export interface UpdateSpaceResponse {
  success: boolean;
  message: string;
  spaceId: string;
  updatedFields?: string[];
}

export interface DeleteSpaceResponse {
  success: boolean;
  message: string;
  spaceId: string;
}

export type SpaceDetailResponse = CognitiveSpace & { loadedAt: string };
