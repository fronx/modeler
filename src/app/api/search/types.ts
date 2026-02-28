import type { SpaceSearchResult, NodeSearchResult } from '@/lib/turso-database-0';

export interface SearchSpacesResponse {
  query: string;
  results: SpaceSearchResult[];
  count: number;
}

export interface SearchNodesResponse {
  query: string;
  spaceId: string | null;
  results: NodeSearchResult[];
  count: number;
  threshold: number;
}
