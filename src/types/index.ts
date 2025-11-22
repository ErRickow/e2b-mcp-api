/**
 * TypeScript types for APILab
 */

// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

// API Response types
export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  timing: {
    duration: number;
    unit: string;
  };
  url: string;
  method: string;
}

// MCP types
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpServer {
  getUrl: () => string;
  getTools: () => Promise<McpTool[]>;
  callTool: (name: string, args: Record<string, any>) => Promise<any>;
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result?: any;
  }>;
}

// Hook return types
export interface UseMcpToolsReturn {
  isStarting: boolean;
  isReady: boolean;
  tools: any; // AI SDK tools format (Record<string, any>)
  error: Error | null;
  startHttpClient: () => Promise<void>;
  restartConnection: () => Promise<void>;
  mcpServer: any; // E2B Sandbox instance
  callTool: (toolName: string, args: Record<string, any>) => Promise<any>;
}

export interface UseApiChatReturn {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  error: Error | null;
  toolExecutions: Array<{
    id: string;
    toolName: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    args?: Record<string, any>;
    result?: any;
    error?: string;
    startTime?: number;
    endTime?: number;
  }>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  stop: () => void;
  clearToolExecutions: () => void;
}
