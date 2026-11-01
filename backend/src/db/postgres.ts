import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import type { AppData, FocusSession, Meta, Project, Settings, Task, User } from '../types.js';
import { defaultMeta, defaultSettings } from './defaults.js';
import { DataValidationError } from './errors.js';

export { defaultMeta, defaultSettings } from './defaults.js';
type Row = Record<string, unknown>;
type Table = 'projects' | 'tasks' | 'focus_sessions' | 'settings' | 'meta';
const connectionString = process.env.DATABASE_URL!;
let url: URL;
try { url = new URL(connectionString); } catch { throw new Error('Invalid DATABASE_URL'); }
if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
// Enforce certificate verification for remote databases, including Supabase.
for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
export const pool = new pg.Pool({ connectionString: url.toString(), ssl: local ? undefined : { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') }, max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000, query_timeout: 30000 });
pool.on('error', () => console.error('[database] Idle PostgreSQL connection failed'));
const context = new AsyncLocalStorage<{ client: pg.PoolClient; owner?: string }>();
async function query(sql: string, values: unknown[] = []) { return (context.getStore()?.client ?? pool).query<Row>(sql, values); }
async function transaction<T>(fn: () => Promise<T>, readOnly = false): Promise<T> {
  if (context.getStore()) return fn();
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await context.run({ client }, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function write<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return transaction(async () => {
    const state = context.getStore()!;
    if (state.owner !== userId) {
      if (state.owner) throw new DataValidationError('Cannot write multiple users in one workspace transaction');
      const user = await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new DataValidationError('User not found');
      await query('INSERT INTO data_revisions(user_id,revision) VALUES($1,0) ON CONFLICT DO NOTHING', [userId]);
      await query('SELECT revision FROM data_revisions WHERE user_id=$1 FOR UPDATE', [userId]);
      state.owner = userId;
    }
    return fn();
  });
}
export async function initDb(): Promise<void> {
  const migration = await readFile(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8');
  const checksum = crypto.createHash('sha256').update(migration).digest('hex');
  await transaction(async () => {
    await query('SELECT pg_advisory_xact_lock(874321,1)');
    await query('CREATE TABLE IF NOT EXISTS tinydo_schema_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const found = (await query('SELECT checksum FROM tinydo_schema_migrations WHERE version=$1', ['001'])).rows[0];
    if (found) { if (found.checksum !== checksum) throw new Error('Database migration checksum mismatch'); return; }
    await query(migration);
    await query('INSERT INTO tinydo_schema_migrations(version,checksum) VALUES($1,$2)', ['001', checksum]);
  });
}
const optional = (value: unknown): string | undefined => value == null || value === '' ? undefined : String(value);
const json = <T>(value: unknown, fallback: T): T => value == null ? fallback : typeof value === 'string' ? JSON.parse(value) as T : value as T;
function userFrom(row: Row): User {
  return { id: String(row.id), name: String(row.name), username: String(row.username), passwordHash: String(row.password_hash), role: row.role === 'admin' ? 'admin' : 'user', authVersion: Number(row.auth_version), createdAt: String(row.created_at), avatar: optional(row.avatar), passwordChangedAt: optional(row.password_changed_at) };
}
export const usersDb = {
  async create(user: User): Promise<void> {
    await query('INSERT INTO users(id,name,username,password_hash,created_at,avatar,password_changed_at,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [user.id, user.name, user.username.trim().toLowerCase(), user.passwordHash, user.createdAt, user.avatar ?? null, user.passwordChangedAt ?? null, user.role ?? 'user']);
  },
  async findById(id: string): Promise<User | null> { const row = (await query('SELECT * FROM users WHERE id=$1', [id])).rows[0]; return row ? userFrom(row) : null; },
  async findByUsername(username: string): Promise<User | null> { const row = (await query('SELECT * FROM users WHERE lower(username)=lower($1)', [username.trim()])).rows[0]; return row ? userFrom(row) : null; },
  async update(id: string, patch: Partial<Omit<User, 'id' | 'username'>>): Promise<User | null> {
    // Update only requested profile fields; do not overwrite a concurrent password change.
    const assignments: string[] = []; const values: unknown[] = [id];
    for (const [key, column] of [['name', 'name'], ['avatar', 'avatar']] as const) if (key in patch) { values.push(patch[key] ?? null); assignments.push(`${column}=$${values.length}`); }
    if (assignments.length) await query(`UPDATE users SET ${assignments.join(',')} WHERE id=$1`, values);
    return usersDb.findById(id);
  },
  async upgradePasswordHash(id: string, expected: string, hash: string): Promise<User | null> {
    const row = (await query('UPDATE users SET password_hash=$1 WHERE id=$2 AND password_hash=$3 RETURNING *', [hash, id, expected])).rows[0]; return row ? userFrom(row) : null;
  },
  async changePassword(id: string, expected: string, hash: string): Promise<User | null> {
    const row = (await query('UPDATE users SET password_hash=$1,password_changed_at=$2,auth_version=auth_version+1 WHERE id=$3 AND password_hash=$4 RETURNING *', [hash, new Date().toISOString(), id, expected])).rows[0]; return row ? userFrom(row) : null;
  },
  async delete(id: string): Promise<boolean> { return !!(await query('DELETE FROM users WHERE id=$1', [id])).rowCount; },
};
async function save(table: Table, fields: Row): Promise<void> {
  const columns = Object.keys(fields); const key = table === 'settings' || table === 'meta' ? 'user_id' : 'id';
  const updates = columns.filter(column => ![key, 'user_id', 'created_at'].includes(column)).map(column => `${column}=excluded.${column}`);
  const result = await query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,i) => `$${i+1}`).join(',')}) ON CONFLICT(${key}) DO UPDATE SET ${updates.join(',')} WHERE ${table}.user_id=excluded.user_id`, Object.values(fields));
  if (!result.rowCount) throw new DataValidationError('Record belongs to another user');
}
export const settingsDb = {
  async get(userId: string): Promise<Settings> {
    const row = (await query('SELECT * FROM settings WHERE user_id=$1', [userId])).rows[0];
    if (!row) return defaultSettings(userId);
    return { userId, theme: row.theme as Settings['theme'], dailyGoalMin: Number(row.daily_goal_min), defaultTaskMin: Number(row.default_task_min) as Settings['defaultTaskMin'], timeZone: String(row.time_zone), weekStart: row.week_start as Settings['weekStart'], autoReplan: Boolean(row.auto_replan), deadlineAlerts: Boolean(row.deadline_alerts), weeklyDigest: Boolean(row.weekly_digest), focusSound: Boolean(row.focus_sound) };
  },
  async save(s: Settings): Promise<void> { await write(s.userId, () => save('settings', { user_id: s.userId, theme: s.theme, daily_goal_min: s.dailyGoalMin, default_task_min: s.defaultTaskMin, time_zone: s.timeZone, week_start: s.weekStart, auto_replan: s.autoReplan, deadline_alerts: s.deadlineAlerts, weekly_digest: s.weeklyDigest, focus_sound: s.focusSound })); },
};
export const metaDb = {
  async get(userId: string): Promise<Meta> {
    const row = (await query('SELECT * FROM meta WHERE user_id=$1', [userId])).rows[0];
    if (!row) return defaultMeta(userId);
    return { userId, lastAutoReplanAt: optional(row.last_auto_replan_at), shownAlerts: json(row.shown_alerts, []), snoozedAlerts: json(row.snoozed_alerts, {}), timer: json(row.timer, undefined), parking: json(row.parking, []), lastReplan: json(row.last_replan, undefined), onboarded: Boolean(row.onboarded) };
  },
  async save(m: Meta): Promise<void> { await write(m.userId, () => save('meta', { user_id: m.userId, last_auto_replan_at: m.lastAutoReplanAt ?? null, shown_alerts: JSON.stringify(m.shownAlerts ?? []), snoozed_alerts: JSON.stringify(m.snoozedAlerts ?? {}), timer: m.timer ? JSON.stringify(m.timer) : null, parking: JSON.stringify(m.parking ?? []), last_replan: m.lastReplan ? JSON.stringify(m.lastReplan) : null, onboarded: !!m.onboarded })); },
};
export const projectsDb = {
  async getByUser(userId: string): Promise<Project[]> { return (await query('SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC,id', [userId])).rows.map(row => ({ id: String(row.id), userId, name: String(row.name), color: String(row.color), description: optional(row.description), priority: row.priority as Project['priority'], dueDate: String(row.due_date), createdAt: String(row.created_at), completedAt: optional(row.completed_at) })); },
  async save(p: Project): Promise<void> { await write(p.userId, () => save('projects', { id: p.id, user_id: p.userId, name: p.name, color: p.color, description: p.description ?? null, priority: p.priority, due_date: p.dueDate, created_at: p.createdAt, completed_at: p.completedAt ?? null })); },
  async delete(id: string, userId: string): Promise<boolean> { return write(userId, async () => {
    await query('UPDATE focus_sessions SET task_id=NULL,project_id=NULL WHERE user_id=$1 AND (project_id=$2 OR task_id IN (SELECT id FROM tasks WHERE project_id=$2 AND user_id=$1))', [userId, id]);
    return !!(await query('DELETE FROM projects WHERE id=$1 AND user_id=$2', [id, userId])).rowCount;
  }); },
};
function validateTask(t: Task): void {
  if (t.subtasks !== undefined && (!Array.isArray(t.subtasks) || t.subtasks.some(s => !s || typeof s.id !== 'string' || !s.id || typeof s.title !== 'string' || !s.title.trim() || typeof s.done !== 'boolean') || new Set(t.subtasks.map(s => s.id)).size !== t.subtasks.length)) throw new DataValidationError('Invalid subtasks');
  if (t.dueDate !== undefined && (typeof t.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) || Number.isNaN(Date.parse(`${t.dueDate}T00:00:00Z`)) || new Date(`${t.dueDate}T00:00:00Z`).toISOString().slice(0,10) !== t.dueDate)) throw new DataValidationError('Invalid task deadline');
}
export const tasksDb = {
  async getByUser(userId: string): Promise<Task[]> { return (await query('SELECT * FROM tasks WHERE user_id=$1 ORDER BY task_order,id', [userId])).rows.map(row => ({ id: String(row.id), userId, projectId: String(row.project_id), section: String(row.section), title: String(row.title), estimateMin: Number(row.estimate_min), status: row.status as Task['status'], order: Number(row.task_order), scheduledFor: optional(row.scheduled_for), dueDate: optional(row.due_date), completedAt: optional(row.completed_at), createdAt: String(row.created_at), replannedFrom: optional(row.replanned_from), subtasks: json(row.subtasks, undefined) })); },
  async save(t: Task): Promise<void> { validateTask(t); await write(t.userId, () => save('tasks', { id: t.id, user_id: t.userId, project_id: t.projectId, section: t.section, title: t.title, estimate_min: t.estimateMin, status: t.status, task_order: t.order, scheduled_for: t.scheduledFor ?? null, due_date: t.dueDate ?? null, completed_at: t.completedAt ?? null, created_at: t.createdAt, replanned_from: t.replannedFrom ?? null, subtasks: t.subtasks === undefined ? null : JSON.stringify(t.subtasks) })); },
  async delete(id: string, userId: string): Promise<boolean> { return write(userId, async () => {
    await query('UPDATE focus_sessions SET task_id=NULL WHERE user_id=$1 AND task_id=$2', [userId,id]);
    return !!(await query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [id,userId])).rowCount;
  }); },
};
export const sessionsDb = {
  async getByUser(userId: string): Promise<FocusSession[]> { return (await query('SELECT * FROM focus_sessions WHERE user_id=$1 ORDER BY started_at DESC,id', [userId])).rows.map(row => ({ id: String(row.id), userId, taskId: optional(row.task_id), projectId: optional(row.project_id), startedAt: String(row.started_at), endedAt: String(row.ended_at), minutes: Number(row.minutes), completedTask: Boolean(row.completed_task) })); },
  async save(s: FocusSession): Promise<void> {
    if ((s.taskId !== undefined && (typeof s.taskId !== 'string' || !s.taskId)) || (s.projectId !== undefined && (typeof s.projectId !== 'string' || !s.projectId))) throw new DataValidationError('Invalid session references');
    await write(s.userId, () => save('focus_sessions', { id: s.id, user_id: s.userId, task_id: s.taskId ?? null, project_id: s.projectId ?? null, started_at: s.startedAt, ended_at: s.endedAt, minutes: s.minutes, completed_task: s.completedTask }));
  },
  async delete(id: string, userId: string): Promise<boolean> { return write(userId, async () => !!(await query('DELETE FROM focus_sessions WHERE id=$1 AND user_id=$2', [id,userId])).rowCount); },
};
export async function getDataRevision(userId: string): Promise<number> {
  const revision = Number((await query('SELECT revision FROM data_revisions WHERE user_id=$1', [userId])).rows[0]?.revision ?? 0);
  if (!Number.isSafeInteger(revision)) throw new Error('Revision exceeds safe range');
  return revision;
}
export async function getAppData(userId: string): Promise<AppData> {
  return transaction(async () => ({ projects: await projectsDb.getByUser(userId), tasks: await tasksDb.getByUser(userId), sessions: await sessionsDb.getByUser(userId), settings: await settingsDb.get(userId), meta: await metaDb.get(userId) }), true);
}
export async function getAppDataSnapshot(userId: string) { return transaction(async () => ({ data: await getAppData(userId), revision: await getDataRevision(userId) }), true); }
export async function saveAppData(userId: string, data: AppData): Promise<void> {
  await write(userId, async () => {
    await settingsDb.save({ ...defaultSettings(userId), ...data.settings, userId });
    await metaDb.save({ ...defaultMeta(userId), ...data.meta, userId });
    for (const p of await projectsDb.getByUser(userId)) if (!data.projects.some(x => x.id === p.id)) await projectsDb.delete(p.id,userId);
    for (const p of data.projects) await projectsDb.save({ ...p,userId });
    for (const t of await tasksDb.getByUser(userId)) if (!data.tasks.some(x => x.id === t.id)) await tasksDb.delete(t.id,userId);
    for (const t of data.tasks) await tasksDb.save({ ...t,userId });
    for (const s of await sessionsDb.getByUser(userId)) if (!data.sessions.some(x => x.id === s.id)) await sessionsDb.delete(s.id,userId);
    for (const s of data.sessions) await sessionsDb.save({ ...s,userId });
  });
}
export async function syncAppData(userId: string, data: AppData, revision: number): Promise<number | null> {
  return write(userId, async () => { if (await getDataRevision(userId) !== revision) return null; await saveAppData(userId,data); return getDataRevision(userId); });
}
export async function createAdminAccount(user: User): Promise<void> { await transaction(async () => { await usersDb.create(user); await metaDb.save({ ...defaultMeta(user.id), onboarded: true }); }); }
export async function getAdminUsers(page: number, search: string, pageSize = 25) {
  return transaction(async () => {
    const filter = 'strpos(lower(u.username),lower($1))>0 OR strpos(lower(u.name),lower($1))>0';
    const total = Number((await query(`SELECT COUNT(*)::int AS total FROM users u WHERE ${filter}`, [search])).rows[0].total);
    const users = (await query(`SELECT u.id,u.name,u.username,u.role,u.created_at AS "createdAt",
      (SELECT COUNT(*)::int FROM projects p WHERE p.user_id=u.id) AS projects,
      (SELECT COUNT(*)::int FROM tasks t WHERE t.user_id=u.id) AS tasks,
      (SELECT COUNT(*)::int FROM tasks t WHERE t.user_id=u.id AND t.status='done') AS "completedTasks",
      (SELECT COUNT(*)::int FROM focus_sessions s WHERE s.user_id=u.id) AS sessions,
      (SELECT COALESCE(SUM(minutes),0) FROM focus_sessions s WHERE s.user_id=u.id) AS "focusMinutes"
      FROM users u WHERE ${filter} ORDER BY u.created_at DESC,u.id LIMIT $2 OFFSET $3`, [search,pageSize,(page-1)*pageSize])).rows;
    const summary = (await query(`SELECT (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM projects) AS projects,(SELECT COUNT(*)::int FROM tasks) AS tasks,
      (SELECT COUNT(*)::int FROM focus_sessions) AS sessions,(SELECT COALESCE(SUM(minutes),0) FROM focus_sessions) AS "focusMinutes"`)).rows[0];
    return { users, page, pageSize, total, totalPages: Math.max(1,Math.ceil(total/pageSize)), summary };
  },true);
}
export async function closeDatabase(): Promise<void> { await pool.end(); }
