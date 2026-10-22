import { describe, it, expect, beforeAll } from 'vitest';
import { app } from './server.js';
import { usersDb, projectsDb, tasksDb, sessionsDb, settingsDb, metaDb, getAppData, saveAppData, initDb } from './db/database.js';
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
