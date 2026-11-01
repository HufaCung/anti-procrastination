import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from './server.js';
import { db, initDb, usersDb, projectsDb, tasksDb, sessionsDb, getAppData, getDataRevision } from './db/sqlite.js';
import { hashPassword, verifyPassword } from './security/password.js';
import { signToken, getJwtSecret } from './middleware/auth.js';
import type { Project } from './types.js';

describe('password security and session isolation regressions', () => {
  let server: ReturnType<typeof app.listen>;
  let base: string;
  const call = async (path: string, body?: unknown, token?: string) => {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const signup = () => call('/api/auth/signup', { username: `security-${crypto.randomUUID()}`, password: 'Old-password-123!' });
  beforeAll(async () => {
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

  it('uses random salts and rejects wrong passwords and malformed stored hashes', async () => {
    const first = await hashPassword('Same-password-123!');
    const second = await hashPassword('Same-password-123!');
    expect(first).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(second).not.toBe(first);
    expect(await verifyPassword('u', 'Same-password-123!', first)).toBe(true);
    expect(await verifyPassword('u', 'wrong', first)).toBe(false);
    for (const malformed of ['bad', 'scrypt$999999999$8$3$a$b', 'scrypt$32768$8$3$ff$ff']) expect(await verifyPassword('u', 'pw', malformed)).toBe(false);
  });

  it('upgrades a legacy account only on correct login, including concurrent logins', async () => {
    const id = crypto.randomUUID();
    const username = `legacy-${id}`;
    const password = 'Legacy-password-123!';
    const legacy = crypto.createHash('sha256').update(`nt:${id}:${password}`).digest('hex');
    usersDb.create({ id, username, name: 'Legacy', passwordHash: legacy, createdAt: new Date().toISOString() });
    expect((await call('/api/auth/login', { username, password: 'wrong' })).body.token).toBeUndefined();
    expect(usersDb.findById(id)?.passwordHash).toBe(legacy);
    const results = await Promise.all([call('/api/auth/login', { username, password }), call('/api/auth/login', { username, password })]);
    for (const result of results) expect(result.body.token).toBeTruthy();
    const updated = usersDb.findById(id)!;
    expect(updated.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(updated.authVersion).toBe(0);
    expect(updated.passwordChangedAt).toBeUndefined();
    expect(results[0].body.user).not.toHaveProperty('authVersion');
    expect(results[0].body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects client hash fields, weak passwords and incorrect current passwords', async () => {
    const account = await signup();
    const token = account.body.token;
    const oldHash = usersDb.findById(account.body.user.id)!.passwordHash;
    for (const payload of [
      { oldPasswordHash: oldHash, newPassword: 'New-password-123!' },
      { oldPassword: 'Old-password-123!', newPasswordHash: 'client-supplied' },
      { oldPassword: 'Old-password-123!', newPassword: 'short' },
      { oldPassword: 'Old-password-123!', newPassword: 'x'.repeat(1025) },
      { oldPassword: 'wrong-password', newPassword: 'New-password-123!' },
    ]) expect((await call('/api/auth/change-password', payload, token)).status).toBe(400);
    expect(usersDb.findById(account.body.user.id)!.passwordHash).toBe(oldHash);
    expect((await call('/api/auth/me', undefined, token)).status).toBe(200);
  });

  it('revokes all old JWTs immediately, including pre-migration JWTs issued in the same second', async () => {
    const account = await signup();
    const id = account.body.user.id;
    const legacyToken = jwt.sign({ userId: id }, getJwtSecret(), { expiresIn: '30d' });
    expect((await call('/api/auth/me', undefined, legacyToken)).status).toBe(200);
    const changed = await call('/api/auth/change-password', { oldPassword: 'Old-password-123!', newPassword: 'New-password-123!' }, account.body.token);
    expect(changed.status).toBe(200);
    expect(changed.body.token).toBeTruthy();
    expect((await call('/api/auth/me', undefined, account.body.token)).status).toBe(401);
    expect((await call('/api/auth/me', undefined, legacyToken)).status).toBe(401);
    expect((await call('/api/auth/me', undefined, changed.body.token)).status).toBe(200);
    expect((await call('/api/auth/login', { username: account.body.user.username, password: 'Old-password-123!' })).body.token).toBeUndefined();
    expect((await call('/api/auth/login', { username: account.body.user.username, password: 'New-password-123!' })).body.token).toBeTruthy();
    expect(usersDb.findById(id)?.authVersion).toBe(1);
  });

  it('allows at most one concurrent password change with the old password', async () => {
    const account = await signup();
    const results = await Promise.all(['One-password-123!', 'Two-password-123!'].map(newPassword => call('/api/auth/change-password', { oldPassword: 'Old-password-123!', newPassword }, account.body.token)));
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect(results.filter(result => [401, 409].includes(result.status))).toHaveLength(1);
    expect(usersDb.findById(account.body.user.id)?.authVersion).toBe(1);
  });

  it('validates session references through both granular API and bulk sync with rollback', async () => {
    const a = await signup();
    const b = await signup();
    const project = (userId: string): Project => ({ id: crypto.randomUUID(), userId, name: 'Private', color: '#000', priority: 'high', dueDate: '2027-01-01', createdAt: new Date().toISOString() });
    const pa = project(a.body.user.id); const pa2 = project(a.body.user.id); const pb = project(b.body.user.id);
    [pa, pa2, pb].forEach(p => projectsDb.save(p));
    const ta = { id: crypto.randomUUID(), userId: pa.userId, projectId: pa.id, section: 'Inbox', title: 'Private task', estimateMin: 15, status: 'todo' as const, order: 0, createdAt: new Date().toISOString() };
    const tb = { ...ta, id: crypto.randomUUID(), userId: pb.userId, projectId: pb.id };
    tasksDb.save(ta); tasksDb.save(tb);
    const session = { startedAt: '2026-11-01T01:00:00Z', endedAt: '2026-11-01T01:15:00Z', minutes: 15, completedTask: false };
    for (const reference of [{ projectId: pb.id }, { taskId: tb.id }, { projectId: 'missing' }, { taskId: 'missing' }, { taskId: ta.id, projectId: pa2.id }]) {
      expect((await call('/api/sessions', { ...session, ...reference }, a.body.token)).status).toBe(400);
      const before = getAppData(pa.userId);
      const revision = getDataRevision(pa.userId);
      const data = { ...before, projects: before.projects.map(p => ({ ...p, name: 'Should roll back' })), sessions: [{ ...session, ...reference, id: crypto.randomUUID(), userId: pa.userId }] };
      const response = await fetch(base + '/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.body.token}` }, body: JSON.stringify({ data, revision }) });
      expect(response.status).toBe(400);
      expect(getAppData(pa.userId)).toEqual(before);
      expect(getDataRevision(pa.userId)).toBe(revision);
    }
    for (const reference of [{}, { projectId: pa.id }, { taskId: ta.id }, { taskId: ta.id, projectId: pa.id }]) expect((await call('/api/sessions', { ...session, ...reference }, a.body.token)).status).toBe(201);
    expect(sessionsDb.getByUser(pa.userId)).toHaveLength(4);
    tasksDb.delete(ta.id, pa.userId);
    expect(sessionsDb.getByUser(pa.userId).every(s => !s.taskId)).toBe(true);
    projectsDb.delete(pa.id, pa.userId);
    expect(sessionsDb.getByUser(pa.userId).every(s => !s.projectId)).toBe(true);
    expect(sessionsDb.getByUser(pa.userId)).toHaveLength(4);
    expect((await call('/api/auth/me', undefined, signToken(pb.userId))).status).toBe(200);
  });
  it('repairs invalid legacy session references without deleting history and is idempotent', () => {
    const id = crypto.randomUUID();
    usersDb.create({ id, username: `history-${id}`, name: 'History', passwordHash: 'x', createdAt: new Date().toISOString() });
    db.prepare('INSERT INTO focus_sessions (id, user_id, task_id, project_id, started_at, ended_at, minutes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), id, 'deleted-task', 'foreign-or-deleted-project', '2026-11-01T01:00:00Z', '2026-11-01T01:15:00Z', 15);
    initDb();
    const history = sessionsDb.getByUser(id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ taskId: undefined, projectId: undefined, minutes: 15 });
    const revision = getDataRevision(id);
    initDb();
    expect(getDataRevision(id)).toBe(revision);
    expect(sessionsDb.getByUser(id)).toEqual(history);
  });

});
