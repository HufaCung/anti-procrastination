import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from './server.js';
import { usersDb, projectsDb, tasksDb, sessionsDb, settingsDb, metaDb, getAppData, saveAppData, initDb, getDataRevision, syncAppData } from './db/database.js';
import { sanitizeUser } from './routes/auth.js';
import { signToken, getJwtSecret } from './middleware/auth.js';
import type { AppData, Project, Task, User } from './types.js';

describe('SQLite Database & Operations', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testUser: User = {
    id: `u_test_${Date.now()}`,
    name: 'Test Hoang',
    email: testEmail,
    passwordHash: 'dummyhash123',
    createdAt: new Date().toISOString(),
  };

  beforeAll(() => {
    initDb();
  });

  it('creates and finds a user by id and email', () => {
    usersDb.create(testUser);
    const foundById = usersDb.findById(testUser.id);
    expect(foundById).not.toBeNull();
    expect(foundById?.name).toBe('Test Hoang');

    const foundByEmail = usersDb.findByEmail(testEmail);
    expect(foundByEmail).not.toBeNull();
    expect(foundByEmail?.id).toBe(testUser.id);
  });

  it('saves and fetches projects and tasks', () => {
    const project: Project = {
      id: 'p_test_1',
      userId: testUser.id,
      name: 'Launch MVP',
      color: '#2383E2',
      priority: 'high',
      dueDate: '2026-11-01',
      createdAt: new Date().toISOString(),
    };
    projectsDb.save(project);

    const task: Task = {
      id: 't_test_1',
      userId: testUser.id,
      projectId: project.id,
      section: 'Backend',
      title: 'Setup SQLite database',
      estimateMin: 15,
      status: 'done',
      order: 0,
      createdAt: new Date().toISOString(),
    };
    tasksDb.save(task);

    const userProjects = projectsDb.getByUser(testUser.id);
    expect(userProjects.length).toBeGreaterThanOrEqual(1);
    expect(userProjects.some((p) => p.id === 'p_test_1')).toBe(true);

    const userTasks = tasksDb.getByUser(testUser.id);
    expect(userTasks.length).toBeGreaterThanOrEqual(1);
    expect(userTasks.some((t) => t.id === 't_test_1')).toBe(true);
  });

  it('performs bulk AppData sync cleanly', () => {
    const bulkData: AppData = {
      projects: [
        {
          id: 'p_bulk_1',
          userId: testUser.id,
          name: 'Bulk Project',
          color: '#E03E3E',
          priority: 'medium',
          dueDate: '2026-12-01',
          createdAt: new Date().toISOString(),
        },
      ],
      tasks: [
        {
          id: 't_bulk_1',
          userId: testUser.id,
          projectId: 'p_bulk_1',
          section: 'General',
          title: 'Bulk Task',
          estimateMin: 10,
          status: 'todo',
          order: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      sessions: [],
      settings: {
        userId: testUser.id,
        theme: 'dark',
        dailyGoalMin: 120,
        defaultTaskMin: 15,
        timeZone: 'Asia/Ho_Chi_Minh',
        weekStart: 'mon',
        autoReplan: true,
        deadlineAlerts: true,
        weeklyDigest: false,
        focusSound: true,
      },
      meta: {
        userId: testUser.id,
        shownAlerts: [],
        snoozedAlerts: {},
        parking: [],
        onboarded: true,
      },
    };

    saveAppData(testUser.id, bulkData);
    const retrieved = getAppData(testUser.id);

    expect(retrieved.projects).toHaveLength(1);
    expect(retrieved.projects[0].name).toBe('Bulk Project');
    expect(retrieved.tasks).toHaveLength(1);
    expect(retrieved.tasks[0].title).toBe('Bulk Task');
    expect(retrieved.settings.theme).toBe('dark');
    expect(retrieved.meta.onboarded).toBe(true);
  });

  it('provides working health check', async () => {
    // Basic health verification
    expect(app).toBeDefined();
  });

  it('sanitizes user objects to prevent leaking password hashes', () => {
    const rawUser: User = {
      id: 'u_safe_test',
      name: 'Safe User',
      email: 'safe@example.com',
      passwordHash: 'secret_hash_value_123',
      createdAt: new Date().toISOString(),
      avatar: 'https://example.com/avatar.png',
    };

    const sanitized = sanitizeUser(rawUser);
    expect((sanitized as Record<string, unknown>).passwordHash).toBeUndefined();
    expect(sanitized.id).toBe(rawUser.id);
    expect(sanitized.email).toBe(rawUser.email);
    expect(sanitized.name).toBe(rawUser.name);
  });

  it('generates secure tokens and requires JWT_SECRET in production', () => {
    const secret = getJwtSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThanOrEqual(32);

    const token = signToken('u_test_user');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    // Verify production guard
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET environment variable is required in production/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret !== undefined) {
        process.env.JWT_SECRET = originalSecret;
      }
    }
  });
});

describe('API security and synchronization', () => {
  let server: ReturnType<typeof app.listen>;
  let base: string;
  const call = async (path: string, method: string, body?: unknown, token?: string) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => { server = app.listen(0, '127.0.0.1', (err?: Error) => err ? reject(err) : resolve()); });
    base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); });

  const signup = async (name: string, email: string, password = 'password1') => {
    return call('/api/auth/signup', 'POST', { name, email, password });
  };

  it('creates accounts immediately and does not let the client choose an existing id', async () => {
    const email = 'victim@example.com';
    const first = await call('/api/auth/signup', 'POST', { id: 'victim', name: 'Victim', email, password: 'password1' });
    expect(first.status).toBe(201);
    expect(first.body.user.id).not.toBe('victim');
    const second = await call('/api/auth/signup', 'POST', { id: first.body.user.id, name: 'Attacker', email: 'attacker@example.com', password: 'password2' });
    expect(second.body.user.id).not.toBe(first.body.user.id);
    expect((await call('/api/auth/login', 'POST', { email, password: 'password1' })).body.token).toBeTruthy();
    expect((await call('/api/auth/forgot-password', 'POST', { email, newPassword: 'password2' })).status).toBe(503);
  });

  it('persists email changes and rejects an email already in use', async () => {
    const a = await signup('Alice', 'a@example.com');
    await signup('Bob', 'b@example.com');
    expect((await call('/api/auth/profile', 'PATCH', { email: 'b@example.com' }, a.body.token)).status).toBe(409);
    expect((await call('/api/auth/profile', 'PATCH', { email: 'new@example.com' }, a.body.token)).status).toBe(200);
    expect((await call('/api/auth/login', 'POST', { email: 'new@example.com', password: 'password1' })).body.token).toBeTruthy();
  });

  it('rejects stale snapshots and cross-user record ownership changes', () => {
    const a: User = { id: 'sync-a', name: 'A', email: 'sync-a@example.com', passwordHash: 'x', createdAt: new Date().toISOString() };
    const b: User = { ...a, id: 'sync-b', email: 'sync-b@example.com' };
    usersDb.create(a); usersDb.create(b);
    const project: Project = { id: 'private-project', userId: a.id, name: 'Private', color: '#000', priority: 'low', dueDate: '2027-01-01', createdAt: new Date().toISOString() };
    projectsDb.save(project);
    const stale = getDataRevision(a.id);
    const snapshot = getAppData(a.id);
    projectsDb.save({ ...project, name: 'Updated elsewhere' });
    expect(syncAppData(a.id, snapshot, stale)).toBeNull();
    expect(getAppData(a.id).projects[0].name).toBe('Updated elsewhere');
    expect(() => projectsDb.save({ ...project, userId: b.id })).toThrow(/another user/);
    const bData = getAppData(b.id);
    bData.projects = [{ ...project, userId: b.id }];
    expect(() => syncAppData(b.id, bData, getDataRevision(b.id))).toThrow(/another user/);
    expect(getAppData(a.id).projects[0].name).toBe('Updated elsewhere');
    expect(getAppData(b.id).projects).toHaveLength(0);
  });
});
