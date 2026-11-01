import type { AppData, FocusSession, Project, Settings, Task, User } from './types';

export type SyncResult = { kind: 'success'; revision: number } | { kind: 'conflict' } | { kind: 'retryable' } | { kind: 'rejected'; status: number };

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
  async signUp(payload: { username: string; password: string }) {
    const res = await request<{ token: string; user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.token) {
      setAuthToken(res.token, true);
    }
    return res;
  },

  async logIn(payload: { username: string; password: string; remember?: boolean }) {
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

  async updateProfile(patch: { name?: string; avatar?: string | null }) {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async changePassword(payload: { oldPassword: string; newPassword: string }): Promise<{ token?: string; user?: User; error?: string } | null> {
    let remember = true;
    try { remember = localStorage.getItem(TOKEN_KEY) !== null; } catch { /* storage unavailable */ }
    try {
      const token = getAuthToken();
      const response = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { token?: string; user?: User; error?: string };
      if (!response.ok) return { error: typeof result.error === 'string' ? result.error : 'Could not update password.' };
      if (result.token) setAuthToken(result.token, remember);
      return result;
    } catch { return null; }
  },

  // AppData bulk sync
  async fetchAppData(): Promise<{ data: AppData; revision: number } | 'rejected' | null> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/data', { signal: AbortSignal.timeout(15_000), headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (response.status === 408 || response.status === 429 || response.status >= 500) return null;
      if (!response.ok) return 'rejected';
      return await response.json() as { data: AppData; revision: number };
    } catch { return null; }
  },

  async syncAppData(data: AppData, revision: number): Promise<SyncResult> {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/data', {
        method: 'PUT', signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ data, revision }),
      });
      if (response.status === 409) return { kind: 'conflict' };
      if (response.status >= 500 || response.status === 429 || response.status === 408) return { kind: 'retryable' };
      if (!response.ok) return { kind: 'rejected', status: response.status };
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('revision' in result) || !Number.isSafeInteger(result.revision) || Number(result.revision) < 0) return { kind: 'rejected', status: 502 };
      return { kind: 'success', revision: Number(result.revision) };
    } catch { return { kind: 'retryable' }; }
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
