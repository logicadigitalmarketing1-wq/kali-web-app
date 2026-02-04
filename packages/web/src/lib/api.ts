const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_URL = `${API_BASE}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  meta?: { timestamp: string; requestId?: string };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({})) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new ApiError(
      response.status,
      json.error?.message || 'Request failed',
      json
    );
  }

  // Unwrap the data from the API response envelope
  return json.data;
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: User; requiresTwoFactor?: boolean }>(res);
  },

  async logout() {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    // Logout returns 204 No Content, so don't try to parse JSON
    if (!res.ok) {
      throw new ApiError(res.status, 'Logout failed');
    }
  },

  async getMe() {
    const res = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include',
    });
    return handleResponse<UserProfile>(res);
  },

  async verifyTotp(code: string) {
    const res = await fetch(`${API_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    return handleResponse<{ user: User }>(res);
  },

  // Tools
  async getTools() {
    const res = await fetch(`${API_URL}/tools`, {
      credentials: 'include',
    });
    return handleResponse<Tool[]>(res);
  },

  async getTool(slug: string) {
    const res = await fetch(`${API_URL}/tools/${slug}`, {
      credentials: 'include',
    });
    return handleResponse<Tool>(res);
  },

  async getToolCategories() {
    const res = await fetch(`${API_URL}/tools/categories`, {
      credentials: 'include',
    });
    return handleResponse<ToolCategory[]>(res);
  },

  // Runs
  async createRun(data: CreateRunDto) {
    const res = await fetch(`${API_URL}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Run>(res);
  },

  async getRuns(params?: { status?: string; toolId?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.toolId) searchParams.set('toolId', params.toolId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const res = await fetch(`${API_URL}/runs?${searchParams}`, {
      credentials: 'include',
    });
    return handleResponse<PaginatedRuns>(res);
  },

  async getRun(id: string) {
    const res = await fetch(`${API_URL}/runs/${id}`, {
      credentials: 'include',
    });
    return handleResponse<RunWithDetails>(res);
  },

  async reanalyzeRun(id: string) {
    const res = await fetch(`${API_URL}/runs/${id}/reanalyze`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<RunWithDetails>(res);
  },

  async stopRun(id: string) {
    const res = await fetch(`${API_URL}/runs/${id}/stop`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async deleteRun(id: string) {
    const res = await fetch(`${API_URL}/runs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Findings
  async getFindings(params?: { severity?: string; runId?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.severity) searchParams.set('severity', params.severity);
    if (params?.runId) searchParams.set('runId', params.runId);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const res = await fetch(`${API_URL}/findings?${searchParams}`, {
      credentials: 'include',
    });
    return handleResponse<Finding[]>(res);
  },

  async getFinding(id: string) {
    const res = await fetch(`${API_URL}/findings/${id}`, {
      credentials: 'include',
    });
    return handleResponse<Finding>(res);
  },

  async deleteFinding(id: string) {
    const res = await fetch(`${API_URL}/findings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Chat
  async sendMessage(conversationId: string | null, message: string, context?: string) {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ conversationId, message, context }),
    });
    return handleResponse<{ conversationId: string; response: string }>(res);
  },

  async *sendMessageStream(
    conversationId: string | null,
    message: string,
    onConversationId?: (id: string) => void,
  ): AsyncGenerator<{
    type: 'text' | 'tool_start' | 'tool_output' | 'tool_complete';
    content?: string;
    toolName?: string;
    toolParams?: Record<string, unknown>;
    duration?: number;
  }> {
    const res = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ conversationId, message }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: 'Stream failed' } }));
      throw new ApiError(res.status, error.error?.message || 'Stream failed');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new ApiError(500, 'No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'init' && parsed.conversationId) {
              onConversationId?.(parsed.conversationId);
            } else if (parsed.type === 'text' && parsed.content) {
              yield { type: 'text', content: parsed.content };
            } else if (parsed.type === 'tool_start') {
              yield { type: 'tool_start', toolName: parsed.toolName, toolParams: parsed.toolParams };
            } else if (parsed.type === 'tool_output') {
              yield { type: 'tool_output', toolName: parsed.toolName, content: parsed.content };
            } else if (parsed.type === 'tool_complete') {
              yield { type: 'tool_complete', toolName: parsed.toolName, duration: parsed.duration };
            } else if (parsed.type === 'error') {
              throw new ApiError(500, parsed.message);
            }
          } catch (e) {
            if (e instanceof ApiError) throw e;
          }
        }
      }
    }
  },

  async getConversations() {
    const res = await fetch(`${API_URL}/chat/conversations`, {
      credentials: 'include',
    });
    return handleResponse<Conversation[]>(res);
  },

  async getConversation(id: string) {
    const res = await fetch(`${API_URL}/chat/conversations/${id}`, {
      credentials: 'include',
    });
    return handleResponse<ConversationWithMessages>(res);
  },

  async deleteConversation(id: string) {
    const res = await fetch(`${API_URL}/chat/conversations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Scopes
  async getScopes() {
    const res = await fetch(`${API_URL}/scopes`, {
      credentials: 'include',
    });
    return handleResponse<Scope[]>(res);
  },

  async createScope(data: { name: string; description?: string; cidrs: string[]; hosts: string[] }) {
    const res = await fetch(`${API_URL}/scopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Scope>(res);
  },

  async updateScope(id: string, data: { name?: string; description?: string; cidrs?: string[]; hosts?: string[]; isActive?: boolean }) {
    const res = await fetch(`${API_URL}/scopes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<Scope>(res);
  },

  async deleteScope(id: string) {
    const res = await fetch(`${API_URL}/scopes/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<void>(res);
  },

  async assignScopeToUser(scopeId: string, userId: string) {
    const res = await fetch(`${API_URL}/scopes/${scopeId}/users/${userId}`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<void>(res);
  },

  async removeScopeFromUser(scopeId: string, userId: string) {
    const res = await fetch(`${API_URL}/scopes/${scopeId}/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<void>(res);
  },

  // Admin - Users
  async getUsers() {
    const res = await fetch(`${API_URL}/users`, {
      credentials: 'include',
    });
    return handleResponse<User[]>(res);
  },

  async createUser(data: { email: string; password: string; name?: string; role?: string }) {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async getUser(id: string) {
    const res = await fetch(`${API_URL}/users/${id}`, {
      credentials: 'include',
    });
    return handleResponse<User & { scopes: Scope[] }>(res);
  },

  async updateUser(id: string, data: { role?: string; isActive?: boolean }) {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async deleteUser(id: string) {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<void>(res);
  },

  // Dashboard stats
  async getDashboardStats() {
    const res = await fetch(`${API_URL}/dashboard/stats`, {
      credentials: 'include',
    });
    return handleResponse<DashboardStats>(res);
  },

  // Health
  async getHealth() {
    const res = await fetch(`${API_URL}/health`);
    return handleResponse<{ status: string; hexstrike: { status: string; tools_available: number } }>(res);
  },

  // Smart Scan
  async getSmartScans(params?: { limit?: number; offset?: number; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.status) searchParams.set('status', params.status);

    const res = await fetch(`${API_URL}/smart-scan?${searchParams}`, {
      credentials: 'include',
    });
    return handleResponse<PaginatedSmartScans>(res);
  },

  async getSmartScanCounts() {
    const res = await fetch(`${API_URL}/smart-scan/counts`, {
      credentials: 'include',
    });
    return handleResponse<SmartScanStatusCounts>(res);
  },

  async startSmartScan(id: string) {
    const res = await fetch(`${API_URL}/smart-scan/${id}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<SmartScanSummary>(res);
  },

  async cancelSmartScan(id: string) {
    const res = await fetch(`${API_URL}/smart-scan/${id}/cancel`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(res);
  },

  async deleteSmartScan(id: string) {
    const res = await fetch(`${API_URL}/smart-scan/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Direct Messages
  async createDMConversation(participantIds: string[], initialMessage?: string) {
    const res = await fetch(`${API_URL}/dm/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ participantIds, initialMessage }),
    });
    return handleResponse<DMConversation>(res);
  },

  async getDMConversations() {
    const res = await fetch(`${API_URL}/dm/conversations`, {
      credentials: 'include',
    });
    return handleResponse<DMConversation[]>(res);
  },

  async getDMConversation(id: string) {
    const res = await fetch(`${API_URL}/dm/conversations/${id}`, {
      credentials: 'include',
    });
    return handleResponse<DMConversationWithMessages>(res);
  },

  async sendDirectMessage(conversationId: string, content: string) {
    const res = await fetch(`${API_URL}/dm/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    return handleResponse<DirectMessage>(res);
  },

  async getUnreadDMCount() {
    const res = await fetch(`${API_URL}/dm/unread-count`, {
      credentials: 'include',
    });
    return handleResponse<{ count: number }>(res);
  },

  async getMessageableUsers() {
    const res = await fetch(`${API_URL}/dm/users`, {
      credentials: 'include',
    });
    return handleResponse<MessageableUser[]>(res);
  },
};

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER';
  isActive: boolean;
  createdAt: string;
  twoFactorEnabled?: boolean;
}

export interface UserProfile {
  user: User & {
    recoveryCodesRemaining?: number;
  };
}

export interface ToolCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  tools: Tool[];
}

export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category?: ToolCategory;
  riskLevel: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isEnabled: boolean;
  manifests?: ToolManifest[];
}

export interface ToolManifest {
  id: string;
  toolId: string;
  version: number;
  binary: string;
  argsSchema: Record<string, unknown>;
  commandTemplate: string[];
  timeout: number;
  memoryLimit: number;
  cpuLimit: number;
  isActive: boolean;
}

export interface Scope {
  id: string;
  name: string;
  description: string | null;
  cidrs: string[];
  hosts: string[];
  isActive: boolean;
}

export interface CreateRunDto {
  toolSlug: string;
  params: Record<string, unknown>;
  target: string;
  scopeId: string;
  timeout?: number;
}

export interface Run {
  id: string;
  userId: string;
  toolId: string;
  tool?: Tool;
  scopeId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  params: Record<string, unknown>;
  target: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  exitCode: number | null;
  error: string | null;
  createdAt: string;
  _count?: {
    findings: number;
  };
}

export interface RunArtifact {
  id: string;
  runId: string;
  type: string;
  content: string;
  mimeType: string;
  createdAt: string;
}

export interface RunAnalysis {
  id: string;
  runId: string;
  summary: string;
  observations: string[];
  recommendations: string[];
  rawResponse: unknown;
  modelUsed: string;
  tokensUsed: number | null;
  createdAt: string;
}

export interface RunWithDetails extends Run {
  artifacts: RunArtifact[];
  analysis: RunAnalysis | null;
  findings: Finding[];
}

export interface PaginatedRuns {
  data: Run[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface Finding {
  id: string;
  runId: string;
  run?: Run;
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number | null;
  cveId: string | null;
  cweId: string | null;
  owaspId: string | null;
  location: string | null;
  evidence: string | null;
  remediation: string | null;
  exploitation: string | null;
  verification: string | null;
  references: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  context: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  tokensUsed: number | null;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface DashboardStats {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  recentRuns: Run[];
  findingsBySeverity: { severity: string; count: number }[];
}

export interface SmartScanSummary {
  id: string;
  name: string | null;
  target: string;
  objective: string;
  status: 'CREATED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';
  progress: number;
  currentPhase: string | null;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  riskScore: number;
  findingsCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PaginatedSmartScans {
  data: SmartScanSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SmartScanStatusCounts {
  all: number;
  CREATED: number;
  RUNNING: number;
  COMPLETED: number;
  FAILED: number;
  CANCELLED: number;
}

// Direct Messages Types
export interface MessageableUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'ENGINEER' | 'VIEWER';
}

export interface DMParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  user: MessageableUser;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  role: string;
  content: string;
  createdAt: string;
  sender: MessageableUser | null;
}

export interface DMConversation {
  id: string;
  type: 'DIRECT_MESSAGE';
  createdAt: string;
  updatedAt: string;
  participants: DMParticipant[];
  messages?: DirectMessage[];
}

export interface DMConversationWithMessages extends DMConversation {
  messages: DirectMessage[];
}
