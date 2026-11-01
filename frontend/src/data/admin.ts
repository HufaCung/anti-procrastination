import { getAuthToken } from './api';

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
  projects: number;
  tasks: number;
  completedTasks: number;
  sessions: number;
  focusMinutes: number;
}
export interface AdminUsersResult {
  users: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: { users: number; projects: number; tasks: number; sessions: number; focusMinutes: number };
}
export async function fetchAdminUsers(page: number, search: string, signal: AbortSignal): Promise<AdminUsersResult> {
  const token = getAuthToken();
  const response = await fetch(`/api/admin/users?${new URLSearchParams({ page: String(page), q: search })}`, {
    signal, cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) throw new Error('Your session has expired. Log out and sign in again.');
  if (response.status === 403) throw new Error('Access denied. This screen is available to administrators only.');
  if (!response.ok) throw new Error('Could not load users. Try again.');
  return response.json() as Promise<AdminUsersResult>;
}
