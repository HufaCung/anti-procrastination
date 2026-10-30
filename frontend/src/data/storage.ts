/**
 * Repository layer over localStorage. Everything the UI persists goes through here,
 * so a real API (e.g. Supabase) can replace it without touching components.
 */
import type { AppData, FocusSession, Meta, Project, Settings, Task, User } from './types';

export const SCHEMA_VERSION = 1;
const PREFIX = 'nt:v1:';
export const KEYS = {
  version: `${PREFIX}version`,
  users: `${PREFIX}users`,
  settings: `${PREFIX}settings`,
  projects: `${PREFIX}projects`,
  tasks: `${PREFIX}tasks`,
  sessions: `${PREFIX}sessions`,
  meta: `${PREFIX}meta`,
  session: `${PREFIX}session`,
} as const;
export const THEME_KEY = 'nt-theme';

type Collection = 'users' | 'settings' | 'projects' | 'tasks' | 'sessions' | 'meta';

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T, store: Storage | null = ls()): T {
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown, store: Storage | null = ls()): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded or private mode: keep the app usable in memory.
    console.warn('[storage] could not persist', key, e);
  }
}

function read<T>(c: Collection): T[] {
  const v = readJSON<T[]>(KEYS[c], []);
  return Array.isArray(v) ? v : [];
}

function write<T>(c: Collection, items: T[]): void {
  writeJSON(KEYS[c], items);
}

/** Schema migrations. v1 is the first version, so this is a no-op hook for now. */
export function migrate(): void {
  const store = ls();
  if (!store) return;
  const v = readJSON<number>(KEYS.version, 0);
  if (v === SCHEMA_VERSION) return;
  // Future: if (v < 2) { ...transform collections... }
  writeJSON(KEYS.version, SCHEMA_VERSION);
}

// ---------- Users ----------
export const usersRepo = {
  all: (): User[] => read<User>('users'),
  byEmail: (email: string) => read<User>('users').find((u) => u.email.toLowerCase() === email.trim().toLowerCase()),
  byId: (id: string) => read<User>('users').find((u) => u.id === id),
  save(user: User) {
    const all = read<User>('users').filter((u) => u.id !== user.id);
    write('users', [...all, user]);
  },
  remove(id: string) {
    write('users', read<User>('users').filter((u) => u.id !== id));
  },
};

// ---------- Per-user data ----------
export function defaultSettings(userId: string): Settings {
  return {
    userId,
    theme: (readJSON<string | null>(THEME_KEY, null) as 'light' | 'dark' | null) ?? currentTheme(),
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

export function defaultMeta(userId: string): Meta {
  return { userId, shownAlerts: [], snoozedAlerts: {}, parking: [] };
}

function currentTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function loadUserData(userId: string): AppData {
  const settings = read<Settings>('settings').find((s) => s.userId === userId);
  const meta = read<Meta>('meta').find((m) => m.userId === userId);
  return {
    projects: read<Project>('projects').filter((p) => p.userId === userId),
    tasks: read<Task>('tasks').filter((t) => t.userId === userId),
    sessions: read<FocusSession>('sessions').filter((s) => s.userId === userId),
    settings: { ...defaultSettings(userId), ...(settings ?? {}) },
    meta: { ...defaultMeta(userId), ...(meta ?? {}) },
  };
}

export function hasUserData(userId: string): boolean {
  return (['settings', 'meta', 'projects', 'tasks', 'sessions'] as Collection[])
    .some((collection) => read<{ userId: string }>(collection).some((item) => item.userId === userId));
}

function replaceFor<T extends { userId: string }>(c: Collection, userId: string, items: T[]) {
  const others = read<T>(c).filter((x) => x.userId !== userId);
  write(c, [...others, ...items]);
}

export function saveUserData(userId: string, data: AppData): void {
  replaceFor('projects', userId, data.projects);
  replaceFor('tasks', userId, data.tasks);
  replaceFor('sessions', userId, data.sessions);
  replaceFor('settings', userId, [data.settings]);
  replaceFor('meta', userId, [data.meta]);
}

export function deleteUserData(userId: string): void {
  (['projects', 'tasks', 'sessions', 'settings', 'meta'] as Collection[]).forEach((c) =>
    write(c, read<{ userId: string }>(c).filter((x) => x.userId !== userId)),
  );
}
