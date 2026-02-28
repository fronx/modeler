import type { CognitiveSpace } from '@/lib/turso-database-0';

export type SpaceDirectResponse = CognitiveSpace & { loadedAt: string; source: string };
