export interface Session {
  id: string;
  title: string | null;
  spaceId: string | null;
  messageCount: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface SessionsResponse {
  sessions: Session[];
}
