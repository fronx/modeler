export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export type MessageHandler = (message: WebSocketMessage) => void;

export class ThoughtWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private url: string = '';

  constructor() {}

  async connect(): Promise<void> {
    // Get the WebSocket URL from the API if we don't have it yet
    if (!this.url) {
      try {
        const response = await fetch('/api/ws');
        const data = await response.json();
        this.url = data.websocketUrl;
      } catch (error) {
        console.error('Failed to get WebSocket URL from API:', error);
        this.setStatus('error');
        return;
      }
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('🔗 Connected to ThoughtWebSocket');
        this.setStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from ThoughtWebSocket');
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Browser WebSocket errors don't provide much detail for security reasons
        // The actual error information comes via onclose event
        console.error('WebSocket connection error - check if WebSocket server is running on', this.url);
        this.setStatus('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.setStatus('error');
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Message handling
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // Status handling
  onStatusChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status); // Send current status immediately
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Convenience methods for common message types
  requestSpaces(): boolean {
    return this.send({ type: 'get_spaces' });
  }

  subscribeToSpace(spaceId: string): boolean {
    return this.send({ type: 'subscribe_space', spaceId });
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusHandlers.forEach(handler => handler(status));
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimeout = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.connect();
    }, 3000);
  }
}