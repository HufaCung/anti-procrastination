import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, migrate, usersRepo } from './storage';
import { api, TOKEN_KEY } from './api';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('window', { localStorage, sessionStorage });
});
afterEach(() => vi.unstubAllGlobals());

describe('browser credential cleanup and sync response classification', () => {
  it('scrubs cached legacy credentials without removing profiles or workspace data', () => {
    localStorage.setItem(KEYS.users, JSON.stringify([{ id: 'u', name: 'Old', email: 'old-user', createdAt: '2026-01-01', passwordHash: 'secret', token: 'unexpected-secret' }]));
    localStorage.setItem(KEYS.projects, '[{"id":"keep"}]');
    migrate();
    expect(JSON.parse(localStorage.getItem(KEYS.users)!)).toEqual([{ id: 'u', name: 'Old', username: 'old-user', createdAt: '2026-01-01' }]);
    expect(localStorage.getItem(KEYS.projects)).toBe('[{"id":"keep"}]');
    const previous = localStorage.getItem(KEYS.users);
    migrate();
    expect(localStorage.getItem(KEYS.users)).toBe(previous);
  });
  it('never persists unexpected credential fields when saving a profile', () => {
    usersRepo.save({ id: 'u', name: 'User', username: 'user', createdAt: '2026-01-01', ...{ passwordHash: 'secret', token: 'unexpected' } });
    const stored = JSON.parse(localStorage.getItem(KEYS.users)!)[0];
    expect(stored).not.toHaveProperty('passwordHash');
    expect(stored).not.toHaveProperty('token');
  });
  it('preserves non-remembered token storage when changing password', async () => {
    sessionStorage.setItem(TOKEN_KEY, 'old');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'new', user: { id: 'u' } }), { status: 200 })));
    await api.changePassword({ oldPassword: 'old-password', newPassword: 'new-password' });
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('new');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
  for (const [status, kind] of [[409, 'conflict'], [400, 'rejected'], [401, 'rejected'], [429, 'retryable'], [503, 'retryable']] as const) {
    it(`classifies HTTP ${status} as ${kind}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
      expect((await api.syncAppData({} as never, 0)).kind).toBe(kind);
    });
  }
  it('treats network failures as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    expect(await api.syncAppData({} as never, 0)).toEqual({ kind: 'retryable' });
  });
  it('does not classify initial-load authentication failures as transient', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await api.fetchAppData()).toBe('rejected');
  });

});
