import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AppData, FocusSession, Meta, Project, Settings, Task, User } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'notion_toolkit.db');
export const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      avatar TEXT,
      password_changed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      estimate_min INTEGER NOT NULL,
      status TEXT NOT NULL,
      task_order INTEGER NOT NULL,
      scheduled_for TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      replanned_from TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT,
      project_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      completed_task INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'light',
      daily_goal_min INTEGER NOT NULL DEFAULT 180,
      default_task_min INTEGER NOT NULL DEFAULT 15,
      time_zone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      week_start TEXT NOT NULL DEFAULT 'mon',
      auto_replan INTEGER NOT NULL DEFAULT 1,
      deadline_alerts INTEGER NOT NULL DEFAULT 1,
      weekly_digest INTEGER NOT NULL DEFAULT 0,
      focus_sound INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS meta (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_auto_replan_at TEXT,
      shown_alerts TEXT,
      snoozed_alerts TEXT,
      timer TEXT,
      parking TEXT,
      last_replan TEXT,
      onboarded INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON focus_sessions(user_id);
  `);
}

// Initialize tables immediately
initDb();

// ---------------- Users ----------------
export const usersDb = {
  create(user: User): void {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at, avatar, password_changed_at)
      VALUES (@id, @name, @email, @passwordHash, @createdAt, @avatar, @passwordChangedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        password_hash = excluded.password_hash,
        avatar = excluded.avatar,
        password_changed_at = excluded.password_changed_at
    `);
    stmt.run({
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      avatar: user.avatar || null,
      passwordChangedAt: user.passwordChangedAt || null,
    });
  },

  findById(id: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      avatar: row.avatar || undefined,
      passwordChangedAt: row.password_changed_at || undefined,
    };
  },

  findByEmail(email: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      avatar: row.avatar || undefined,
      passwordChangedAt: row.password_changed_at || undefined,
    };
  },

  update(id: string, patch: Partial<User>): User | null {
    const current = usersDb.findById(id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    const stmt = db.prepare(`
      UPDATE users
      SET name = @name, email = @email, password_hash = @passwordHash, avatar = @avatar, password_changed_at = @passwordChangedAt
      WHERE id = @id
    `);
    stmt.run({
      id,
      name: updated.name,
      email: updated.email.toLowerCase().trim(),
      passwordHash: updated.passwordHash,
      avatar: updated.avatar || null,
      passwordChangedAt: updated.passwordChangedAt || null,
    });
    return updated;
  },

  delete(id: string): boolean {
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return info.changes > 0;
  },
};

// ---------------- Settings ----------------
export function defaultSettings(userId: string): Settings {
  return {
    userId,
    theme: 'light',
    dailyGoalMin: 180,
    defaultTaskMin: 15,
    timeZone: 'Asia/Ho_Chi_Minh',
    weekStart: 'mon',
    autoReplan: true,
    deadlineAlerts: true,
    weeklyDigest: false,
    focusSound: true,
  };
}

export const settingsDb = {
  get(userId: string): Settings {
    const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as any;
    if (!row) return defaultSettings(userId);
    return {
      userId: row.user_id,
      theme: row.theme,
      dailyGoalMin: row.daily_goal_min,
      defaultTaskMin: row.default_task_min,
      timeZone: row.time_zone,
      weekStart: row.week_start,
      autoReplan: Boolean(row.auto_replan),
      deadlineAlerts: Boolean(row.deadline_alerts),
      weeklyDigest: Boolean(row.weekly_digest),
      focusSound: Boolean(row.focus_sound),
    };
  },

  save(settings: Settings): void {
    const stmt = db.prepare(`
      INSERT INTO settings (user_id, theme, daily_goal_min, default_task_min, time_zone, week_start, auto_replan, deadline_alerts, weekly_digest, focus_sound)
      VALUES (@userId, @theme, @dailyGoalMin, @defaultTaskMin, @timeZone, @weekStart, @autoReplan, @deadlineAlerts, @weeklyDigest, @focusSound)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        daily_goal_min = excluded.daily_goal_min,
        default_task_min = excluded.default_task_min,
        time_zone = excluded.time_zone,
        week_start = excluded.week_start,
        auto_replan = excluded.auto_replan,
        deadline_alerts = excluded.deadline_alerts,
        weekly_digest = excluded.weekly_digest,
        focus_sound = excluded.focus_sound
    `);
    stmt.run({
      userId: settings.userId,
      theme: settings.theme,
      dailyGoalMin: settings.dailyGoalMin,
      defaultTaskMin: settings.defaultTaskMin,
      timeZone: settings.timeZone,
      weekStart: settings.weekStart,
      autoReplan: settings.autoReplan ? 1 : 0,
      deadlineAlerts: settings.deadlineAlerts ? 1 : 0,
      weeklyDigest: settings.weeklyDigest ? 1 : 0,
      focusSound: settings.focusSound ? 1 : 0,
    });
  },
};

// ---------------- Meta ----------------
export function defaultMeta(userId: string): Meta {
  return { userId, shownAlerts: [], snoozedAlerts: {}, parking: [] };
}

export const metaDb = {
  get(userId: string): Meta {
    const row = db.prepare('SELECT * FROM meta WHERE user_id = ?').get(userId) as any;
    if (!row) return defaultMeta(userId);
    return {
      userId: row.user_id,
      lastAutoReplanAt: row.last_auto_replan_at || undefined,
      shownAlerts: row.shown_alerts ? JSON.parse(row.shown_alerts) : [],
      snoozedAlerts: row.snoozed_alerts ? JSON.parse(row.snoozed_alerts) : {},
      timer: row.timer ? JSON.parse(row.timer) : undefined,
      parking: row.parking ? JSON.parse(row.parking) : [],
      lastReplan: row.last_replan ? JSON.parse(row.last_replan) : undefined,
      onboarded: Boolean(row.onboarded),
    };
  },

  save(meta: Meta): void {
    const stmt = db.prepare(`
      INSERT INTO meta (user_id, last_auto_replan_at, shown_alerts, snoozed_alerts, timer, parking, last_replan, onboarded)
      VALUES (@userId, @lastAutoReplanAt, @shownAlerts, @snoozedAlerts, @timer, @parking, @lastReplan, @onboarded)
      ON CONFLICT(user_id) DO UPDATE SET
        last_auto_replan_at = excluded.last_auto_replan_at,
        shown_alerts = excluded.shown_alerts,
        snoozed_alerts = excluded.snoozed_alerts,
        timer = excluded.timer,
        parking = excluded.parking,
        last_replan = excluded.last_replan,
        onboarded = excluded.onboarded
    `);
    stmt.run({
      userId: meta.userId,
      lastAutoReplanAt: meta.lastAutoReplanAt || null,
      shownAlerts: JSON.stringify(meta.shownAlerts || []),
      snoozedAlerts: JSON.stringify(meta.snoozedAlerts || {}),
      timer: meta.timer ? JSON.stringify(meta.timer) : null,
      parking: JSON.stringify(meta.parking || []),
      lastReplan: meta.lastReplan ? JSON.stringify(meta.lastReplan) : null,
      onboarded: meta.onboarded ? 1 : 0,
    });
  },
};

// ---------------- Projects ----------------
export const projectsDb = {
  getByUser(userId: string): Project[] {
    const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      color: r.color,
      description: r.description || undefined,
      priority: r.priority,
      dueDate: r.due_date,
      createdAt: r.created_at,
      completedAt: r.completed_at || undefined,
    }));
  },

  save(p: Project): void {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, color, description, priority, due_date, created_at, completed_at)
      VALUES (@id, @userId, @name, @color, @description, @priority, @dueDate, @createdAt, @completedAt)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        color = excluded.color,
        description = excluded.description,
        priority = excluded.priority,
        due_date = excluded.due_date,
        completed_at = excluded.completed_at
    `);
    stmt.run({
      id: p.id,
      userId: p.userId,
      name: p.name,
      color: p.color,
      description: p.description || null,
      priority: p.priority,
      dueDate: p.dueDate,
      createdAt: p.createdAt,
      completedAt: p.completedAt || null,
    });
  },

  delete(id: string, userId: string): boolean {
    const info = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },
};

// ---------------- Tasks ----------------
export const tasksDb = {
  getByUser(userId: string): Task[] {
    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY task_order ASC').all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      projectId: r.project_id,
      section: r.section,
      title: r.title,
      estimateMin: r.estimate_min,
      status: r.status,
      order: r.task_order,
      scheduledFor: r.scheduled_for || undefined,
      completedAt: r.completed_at || undefined,
      createdAt: r.created_at,
      replannedFrom: r.replanned_from || undefined,
    }));
  },

  save(t: Task): void {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, user_id, project_id, section, title, estimate_min, status, task_order, scheduled_for, completed_at, created_at, replanned_from)
      VALUES (@id, @userId, @projectId, @section, @title, @estimateMin, @status, @order, @scheduledFor, @completedAt, @createdAt, @replannedFrom)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        project_id = excluded.project_id,
        section = excluded.section,
        title = excluded.title,
        estimate_min = excluded.estimate_min,
        status = excluded.status,
        task_order = excluded.task_order,
        scheduled_for = excluded.scheduled_for,
        completed_at = excluded.completed_at,
        replanned_from = excluded.replanned_from
    `);
    stmt.run({
      id: t.id,
      userId: t.userId,
      projectId: t.projectId,
      section: t.section,
      title: t.title,
      estimateMin: t.estimateMin,
      status: t.status,
      order: t.order,
      scheduledFor: t.scheduledFor || null,
      completedAt: t.completedAt || null,
      createdAt: t.createdAt,
      replannedFrom: t.replannedFrom || null,
    });
  },

  delete(id: string, userId: string): boolean {
    const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },
};

// ---------------- Focus Sessions ----------------
export const sessionsDb = {
  getByUser(userId: string): FocusSession[] {
    const rows = db.prepare('SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC').all(userId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      taskId: r.task_id || undefined,
      projectId: r.project_id || undefined,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      minutes: r.minutes,
      completedTask: Boolean(r.completed_task),
    }));
  },

  save(s: FocusSession): void {
    const stmt = db.prepare(`
      INSERT INTO focus_sessions (id, user_id, task_id, project_id, started_at, ended_at, minutes, completed_task)
      VALUES (@id, @userId, @taskId, @projectId, @startedAt, @endedAt, @minutes, @completedTask)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        task_id = excluded.task_id,
        project_id = excluded.project_id,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        minutes = excluded.minutes,
        completed_task = excluded.completed_task
    `);
    stmt.run({
      id: s.id,
      userId: s.userId,
      taskId: s.taskId || null,
      projectId: s.projectId || null,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      minutes: s.minutes,
      completedTask: s.completedTask ? 1 : 0,
    });
  },

  delete(id: string, userId: string): boolean {
    const info = db.prepare('DELETE FROM focus_sessions WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },
};

// ---------------- Bulk AppData Sync ----------------
export function getAppData(userId: string): AppData {
  return {
    projects: projectsDb.getByUser(userId),
    tasks: tasksDb.getByUser(userId),
    sessions: sessionsDb.getByUser(userId),
    settings: settingsDb.get(userId),
    meta: metaDb.get(userId),
  };
}

export function saveAppData(userId: string, data: AppData): void {
  const syncTx = db.transaction(() => {
    // Save settings and meta
    settingsDb.save({ ...defaultSettings(userId), ...data.settings, userId });
    metaDb.save({ ...defaultMeta(userId), ...data.meta, userId });

    // Sync projects: remove old projects not in data, upsert existing/new
    const projectIds = new Set(data.projects.map((p) => p.id));
    const currentProjects = projectsDb.getByUser(userId);
    for (const cp of currentProjects) {
      if (!projectIds.has(cp.id)) {
        projectsDb.delete(cp.id, userId);
      }
    }
    for (const p of data.projects) {
      projectsDb.save({ ...p, userId });
    }

    // Sync tasks: remove old tasks not in data, upsert existing/new
    const taskIds = new Set(data.tasks.map((t) => t.id));
    const currentTasks = tasksDb.getByUser(userId);
    for (const ct of currentTasks) {
      if (!taskIds.has(ct.id)) {
        tasksDb.delete(ct.id, userId);
      }
    }
    for (const t of data.tasks) {
      tasksDb.save({ ...t, userId });
    }

    // Sync sessions: remove old sessions not in data, upsert existing/new
    const sessionIds = new Set(data.sessions.map((s) => s.id));
    const currentSessions = sessionsDb.getByUser(userId);
    for (const cs of currentSessions) {
      if (!sessionIds.has(cs.id)) {
        sessionsDb.delete(cs.id, userId);
      }
    }
    for (const s of data.sessions) {
      sessionsDb.save({ ...s, userId });
    }
  });

  syncTx();
}

export function deleteUserData(userId: string): void {
  const delTx = db.transaction(() => {
    db.prepare('DELETE FROM focus_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM projects WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM meta WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  delTx();
}
