import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auth_token', token);
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async register(email: string, password: string, name?: string, organizationName?: string) {
    const { data } = await this.client.post('/auth/register', {
      email,
      password,
      name,
      organizationName,
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  // Agents
  async listAgents(organizationId: string) {
    const { data } = await this.client.get('/agents', { params: { organizationId } });
    return data;
  }

  async getAgent(id: string, organizationId: string) {
    const { data } = await this.client.get(`/agents/${id}`, { params: { organizationId } });
    return data;
  }

  async createAgent(agentData: any) {
    const { data } = await this.client.post('/agents', agentData);
    return data;
  }

  async updateAgent(id: string, agentData: any, organizationId: string) {
    const { data } = await this.client.put(`/agents/${id}`, agentData, {
      params: { organizationId },
    });
    return data;
  }

  async deleteAgent(id: string, organizationId: string) {
    const { data } = await this.client.delete(`/agents/${id}`, { params: { organizationId } });
    return data;
  }

  async getSystemPrompts(agentId: string, organizationId: string) {
    const { data } = await this.client.get(`/agents/${agentId}/system-prompts`, {
      params: { organizationId },
    });
    return data;
  }

  async createSystemPrompt(agentId: string, promptData: any, organizationId: string) {
    const { data } = await this.client.post(`/agents/${agentId}/system-prompts`, promptData, {
      params: { organizationId },
    });
    return data;
  }

  async activateSystemPrompt(agentId: string, promptId: string, organizationId: string) {
    const { data } = await this.client.post(
      `/agents/${agentId}/system-prompts/${promptId}/activate`,
      {},
      { params: { organizationId } }
    );
    return data;
  }

  async getAgentRuns(agentId: string, organizationId: string, limit = 20, offset = 0) {
    const { data } = await this.client.get(`/agents/${agentId}/runs`, {
      params: { organizationId, limit, offset },
    });
    return data;
  }

  async runAgent(agentId: string, organizationId: string, input: any) {
    const { data } = await this.client.post(`/agents/${agentId}/run`, {
      organizationId,
      input,
    });
    return data;
  }

  // Chat
  async listChats(organizationId: string, limit = 20, offset = 0) {
    const { data } = await this.client.get('/chat/list', {
      params: { organizationId, limit, offset },
    });
    return data;
  }

  async getChatHistory(chatId: string) {
    const { data } = await this.client.get('/chat/history', { params: { chatId } });
    return data;
  }

  async sendMessage(messageData: {
    chatId?: string;
    organizationId: string;
    agentId?: string;
    message: string;
    attachments?: string[];
  }) {
    const { data } = await this.client.post('/chat/send', messageData);
    return data;
  }

  async submitChatFeedback(eventId: string, feedbackType: string, comment?: string) {
    const { data } = await this.client.post('/chat/feedback', {
      eventId,
      feedbackType,
      comment,
    });
    return data;
  }

  async deleteChat(chatId: string) {
    const { data } = await this.client.delete(`/chat/${chatId}`);
    return data;
  }
}

export const apiClient = new ApiClient();
