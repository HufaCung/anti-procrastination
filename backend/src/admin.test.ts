import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { app } from './server.js';
import { createAdmin } from './services/admin-account.js';
import { db, usersDb, projectsDb, tasksDb, sessionsDb, metaDb, defaultMeta } from './db/sqlite.js';
import { signToken } from './middleware/auth.js';

describe('admin account and read-only users API', () => {
  let server: ReturnType<typeof app.listen>;
  let base: string;
  const password = crypto.randomUUID();
  const adminName = `admin-${crypto.randomUUID()}`;
  let adminId: string;
  const call = async (route: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  beforeAll(async () => {
    adminId = (await createAdmin(adminName, password)).userId;
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

  it('provisions once, logs in normally, and never resets an existing password', async () => {
    expect(await createAdmin(adminName, password)).toEqual({ created: false, userId: adminId });
    await expect(createAdmin(adminName, 'different-password')).rejects.toThrow(/different password/);
    const login = await call('/api/auth/login', undefined, { username: adminName, password });
    expect(login.body.user.role).toBe('admin');
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.passwordHash).toBeUndefined();
  });

  it('rejects missing tokens and the development user-id shortcut', async () => {
    expect((await call('/api/admin/users')).status).toBe(401);
    expect((await call('/api/admin/users', undefined, undefined, { 'x-user-id': adminId })).status).toBe(401);
    expect((await call('/api/admin/users', 'invalid-token')).status).toBe(401);
  });

  it('ignores client role claims and refuses to promote existing normal accounts', async () => {
    const username = `normal-${crypto.randomUUID()}`;
    const signup = await call('/api/auth/signup', undefined, { username, password, role: 'admin', isAdmin: true });
    expect(signup.body.user.role).toBe('user');
    expect((await call('/api/admin/users', signup.body.token)).status).toBe(403);
    await expect(createAdmin(username, password)).rejects.toThrow(/regular user/);
    expect(usersDb.findById(signup.body.user.id)?.role).toBe('user');
  });

  it('returns exact aggregate counts and an explicit safe projection', async () => {
    const id = crypto.randomUUID();
    usersDb.create({ id, username: `stats-${id}`, name: 'Stats user', passwordHash: 'sensitive-password-hash', createdAt: new Date().toISOString(), avatar: 'private-avatar' });
    const project = { id: crypto.randomUUID(), userId: id, name: 'PRIVATE PROJECT', description: 'PRIVATE DESCRIPTION', color: '#000', priority: 'high' as const, dueDate: '2027-01-01', createdAt: new Date().toISOString() };
    projectsDb.save(project);
    tasksDb.save({ id: crypto.randomUUID(), userId: id, projectId: project.id, section: 'Private', title: 'PRIVATE TASK', estimateMin: 15, status: 'done', order: 0, createdAt: new Date().toISOString() });
    sessionsDb.save({ id: crypto.randomUUID(), userId: id, projectId: project.id, startedAt: '2026-11-01T01:00:00Z', endedAt: '2026-11-01T01:15:00Z', minutes: 15, completedTask: false });
    metaDb.save({ ...defaultMeta(id), parking: [{ id: 'note', text: 'PRIVATE NOTE', createdAt: new Date().toISOString() }] });
    const result = await call(`/api/admin/users?q=${encodeURIComponent(`stats-${id}`)}`, signToken(adminId));
    expect(result.status).toBe(200);
    expect(result.cache).toBe('no-store');
    expect(result.body.total).toBe(1);
    expect(result.body.users[0]).toMatchObject({ id, role: 'user', projects: 1, tasks: 1, completedTasks: 1, sessions: 1, focusMinutes: 15 });
    expect(Object.keys(result.body.users[0]).sort()).toEqual(['id', 'name', 'username', 'role', 'createdAt', 'projects', 'tasks', 'completedTasks', 'sessions', 'focusMinutes'].sort());
    const text = JSON.stringify(result.body);
    for (const sensitive of ['passwordHash', 'password_hash', 'avatar', 'PRIVATE PROJECT', 'PRIVATE DESCRIPTION', 'PRIVATE TASK', 'PRIVATE NOTE']) expect(text).not.toContain(sensitive);
  });

  it('paginates deterministically, searches literally and validates queries', async () => {
    for (let i = 0; i < 27; i++) usersDb.create({ id: `page-${i}`, username: `page-${i}`, name: 'Pagination', passwordHash: 'x', createdAt: '2026-11-01T00:00:00Z' });
    const token = signToken(adminId);
    const first = await call('/api/admin/users?q=page-&page=1', token);
    const second = await call('/api/admin/users?q=page-&page=2', token);
    expect(first.body.users).toHaveLength(25);
    expect(second.body.users).toHaveLength(2);
    expect(first.body.total).toBe(27);
    const ids = [...first.body.users, ...second.body.users].map(user => user.id);
    expect(new Set(ids).size).toBe(27);
    expect((await call('/api/admin/users?q=%25', token)).body.total).toBe(0);
    for (const query of ['page=0', 'page=1.5', 'page=1000001', 'q=a&q=b', `q=${'x'.repeat(101)}`]) expect((await call(`/api/admin/users?${query}`, token)).status).toBe(400);
    expect((await call('/api/admin/users?q=never-found', token)).body.users).toEqual([]);
  });

  it('checks the current database role even with an already issued token', async () => {
    const created = await createAdmin(`revoke-${crypto.randomUUID()}`, password);
    const token = signToken(created.userId);
    expect((await call('/api/admin/users', token)).status).toBe(200);
    db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(created.userId);
    expect((await call('/api/admin/users', token)).status).toBe(403);
  });
});
