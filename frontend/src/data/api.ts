import type { AppData, FocusSession, Project, Settings, Task, User } from './types';

export const TOKEN_KEY = 'nt:v1:token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null, remember = true): void {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } else if (remember) {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    /* ignore */
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  // Auth
  async signUp(payload: { name: string; email: string; password: string }) {
    const res = await request<{ token: string; user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.token) {
      setAuthToken(res.token, true);
    }
    return res;
  },

  async logIn(payload: { email: string; password?: string; passwordHash?: string; remember?: boolean }) {
    const res = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.token) {
      setAuthToken(res.token, payload.remember ?? true);
    }
    return res;
  },

  async getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(patch: { name?: string; email?: string; avatar?: string | null }) {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async changePassword(payload: { oldPassword: string; newPassword: string }) {
    return request<{ user: User }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteAccount() {
    return request<{ success: boolean }>('/api/auth/account', {
      method: 'DELETE',
    });
  },

  // AppData bulk sync
  async fetchAppData(): Promise<{ data: AppData; revision: number } | null> {
    return request<{ data: AppData; revision: number }>('/api/data');
  },

  async syncAppData(data: AppData, revision: number): Promise<{ revision: number } | 'conflict' | null> {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data, revision }) });
      if (res.status === 409) return 'conflict';
      return res.ok ? await res.json() as { revision: number } : null;
    } catch { return null; }
  },

  // Granular project / task / session APIs
  async createProject(project: Project) {
    return request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  },

  async deleteProject(id: string) {
    return request<{ success: boolean }>(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  },

  async createTask(task: Task) {
    return request<{ task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  },

  async deleteTask(id: string) {
    return request<{ success: boolean }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  async createSession(session: FocusSession) {
    return request<{ session: FocusSession }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  },

  async updateSettings(settings: Partial<Settings>) {
    return request<{ settings: Settings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },
};
