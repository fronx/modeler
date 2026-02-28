export interface ClaudeCodeStatusResponse {
  status: string;
  mode: string;
  billing: string;
  active: boolean;
  messageCount: number;
  isStreaming: boolean;
  sessionId: string | null;
  claudeSessionId: string | null;
  hasPersistedSession: boolean;
}

export interface SessionActionResponse {
  status: string;
  message: string;
}

export interface CancelResponse {
  success: boolean;
  message: string;
}

export interface ResumeSessionResponse {
  status: string;
  message: string;
  sessionId: string | null;
}
