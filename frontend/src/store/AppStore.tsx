import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AppData, FocusSession, Priority, Project, Settings, Task, TaskStatus, Theme, User } from '../data/types';
import * as auth from '../data/auth';
import { THEME_KEY, loadUserData, saveUserData, usersRepo } from '../data/storage';
import { api } from '../data/api';
import { PROJECT_COLORS } from '../data/colors';
import { uid } from '../logic/ids';
import { addDays, dayKey, startOfDay } from '../logic/dates';
import { cycleTask, startTask, toggleDone, withStatus } from '../logic/status';
import { projectStats, type ProjectStats } from '../logic/progress';
import { applyPlacements, autoReplanDue, replan, revertPlacements, schedule, slippedTasks, type Placement } from '../logic/schedule';
import * as T from '../logic/timer';
import { pendingAlerts } from '../logic/alerts';
import { useToast } from './toast';
import { chime } from '../components/chime';

// ---------------- Theme ----------------
export function applyTheme(t: Theme, animate = true) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 260);
  }
  root.setAttribute('data-theme', t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// ---------------- Reducer ----------------
type Action = { type: 'load'; data: AppData | null } | { type: 'update'; fn: (d: AppData) => AppData };

function reducer(state: AppData | null, action: Action): AppData | null {
  if (action.type === 'load') return action.data;
  if (!state) return state;
  return finalizeProjects(action.fn(state));
}

/** Keep project.completedAt in sync with its tasks. */
function finalizeProjects(d: AppData): AppData {
  let changed = false;
  const projects = d.projects.map((p) => {
    const own = d.tasks.filter((t) => t.projectId === p.id);
    const allDone = own.length > 0 && own.every((t) => t.status === 'done');
    if (allDone && !p.completedAt) {
      changed = true;
      const last = Math.max(...own.map((t) => (t.completedAt ? new Date(t.completedAt).getTime() : Date.now())));
      return { ...p, completedAt: new Date(last).toISOString() };
    }
    if (!allDone && p.completedAt && own.length > 0) {
      changed = true;
      const { completedAt: _c, ...rest } = p;
      void _c;
      return rest as Project;
    }
    return p;
  });
  return changed ? { ...d, projects } : d;
}

// ---------------- Context ----------------
export interface NewProjectInput {
  name: string;
  dueDate: string;
  priority: Priority;
  color?: string;
  description?: string;
}

export interface AppStore {
  ready: boolean;
  user: User | null;
  data: AppData | null;
  now: Date;
  theme: Theme;
  // derived
  activeProjects: Project[];
  stats: Map<string, ProjectStats>;
  tasksOf: (projectId: string) => Task[];
  projectById: (id: string) => Project | undefined;
  todayTasks: Task[];
  todayFocusMin: number;
  todaySessions: number;
  replanPreview: Placement[];
  // auth
  signUp: typeof auth.signUp;
  logIn: typeof auth.logIn;
  logOut: () => void;
  refreshUser: () => void;
  deleteAccount: () => void;
  // settings
  setTheme: (t: Theme) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  // projects
  createProject: (input: NewProjectInput) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  // tasks
  addTask: (input: { projectId: string; title: string; estimateMin: number; section?: string; scheduledFor?: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  restoreTask: (task: Task) => void;
  moveTask: (id: string, dir: -1 | 1) => void;
  cycleStatus: (id: string) => void;
  toggleTaskDone: (id: string) => void;
  setStatus: (id: string, s: TaskStatus) => void;
  // scheduling
  planMyDay: () => { placed: number; unplaced: number };
  applyReplan: (placements?: Placement[]) => number;
  undoReplan: () => void;
  replanProject: (projectId: string) => { placed: number; unplaced: number };
  replanProjectToToday: (projectId: string) => { placed: number; unplaced: number };
  pullIntoDay: (day: Date) => number;
  snoozeAlert: (projectId: string) => void;
  markOnboarded: () => void;
  // focus
  timerSetLength: (min: number) => void;
  timerSelectTask: (taskId: string | undefined) => void;
  timerStart: () => void;
  timerPause: () => void;
  timerReset: () => void;
  timerExtend: () => void;
  timerComplete: (byTimer?: boolean) => void;
  addParking: (text: string) => void;
  removeParking: (id: string) => void;
}

const Ctx = createContext<AppStore | null>(null);

export function useStore(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <AppProvider>');
  return v;
}

function useClock(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms]);
  return now;
}

export function useNow(ms = 1000) {
  return useClock(ms);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(() => auth.currentUser());
  const [data, dispatch] = useReducer(reducer, null, () => {
    const u = auth.currentUser();
    return u ? loadUserData(u.id) : null;
  });
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const now = useClock(15_000);
  const dataRef = useRef(data);
  dataRef.current = data;
  const userRef = useRef(user);
  userRef.current = user;

  // Persist on every change to localStorage and backend SQLite.
  useEffect(() => {
    if (user && data) {
      saveUserData(user.id, data);
      api.syncAppData(data).catch(() => {});
    }
  }, [user, data]);

  // Fetch fresh data from backend SQLite when user logs in with an empty local store
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.fetchAppData().then((remoteData) => {
      if (cancelled || !remoteData) return;
      const local = dataRef.current;
      const isEmpty = !local || (local.projects.length === 0 && local.tasks.length === 0);
      if (isEmpty && (remoteData.projects.length > 0 || remoteData.tasks.length > 0)) {
        dispatch({ type: 'load', data: remoteData });
        saveUserData(user.id, remoteData);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Keep theme in sync with the user's settings on login.
  useEffect(() => {
    if (data && data.settings.theme !== readTheme()) {
      applyTheme(data.settings.theme, false);
      setThemeState(data.settings.theme);
    }
    // only when user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue, true);
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => dispatch({ type: 'update', fn }), []);

  // ---------- Derived ----------
  const derived = useMemo(() => {
    if (!data) {
      return {
        activeProjects: [] as Project[], stats: new Map<string, ProjectStats>(), byProject: new Map<string, Task[]>(),
        todayTasks: [] as Task[], todayFocusMin: 0, todaySessions: 0, replanPreview: [] as Placement[],
      };
    }
    const byProject = new Map<string, Task[]>();
    data.tasks.forEach((t) => {
      const arr = byProject.get(t.projectId) ?? [];
      arr.push(t);
      byProject.set(t.projectId, arr);
    });
    byProject.forEach((arr) => arr.sort((a, b) => a.order - b.order));
    const activeProjects = data.projects
      .filter((p) => !p.completedAt)
      .sort((a, b) => (a.dueDate === b.dueDate ? a.name.localeCompare(b.name) : a.dueDate < b.dueDate ? -1 : 1));
    const stats = new Map<string, ProjectStats>();
    for (const p of data.projects) {
      const own = byProject.get(p.id) ?? [];
      // Capacity check: can the remaining unscheduled/slipped work fit before the deadline?
      let unplacedCount = 0;
      if (!p.completedAt) {
        const t0 = startOfDay(now).getTime();
        const toPlace = own.filter((t) => t.status !== 'done' && (!t.scheduledFor || new Date(t.scheduledFor).getTime() < t0));
        if (toPlace.length) unplacedCount = schedule(toPlace, data.settings, data.tasks, data.projects, now).unplaced.length;
      }
      stats.set(p.id, projectStats({
        project: p, tasks: own, sessions: data.sessions, dailyGoalMin: data.settings.dailyGoalMin,
        activeProjectsCount: Math.max(1, activeProjects.length), now, unplacedCount,
      }));
    }
    const todayKey = dayKey(now);
    const todayTasks = data.tasks
      .filter((t) => t.scheduledFor && dayKey(new Date(t.scheduledFor)) === todayKey)
      .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
    const todaySess = data.sessions.filter((s) => dayKey(new Date(s.startedAt)) === todayKey);
    return {
      activeProjects, stats, byProject, todayTasks,
      todayFocusMin: todaySess.reduce((s, x) => s + x.minutes, 0),
      todaySessions: todaySess.length,
      replanPreview: replan({ tasks: data.tasks, projects: data.projects, settings: data.settings }, now),
    };
  }, [data, now]);

  // ---------- Auth ----------
  const loadFor = useCallback((u: User | null) => {
    setUser(u);
    dispatch({ type: 'load', data: u ? loadUserData(u.id) : null });
  }, []);

  const signUp = useCallback<typeof auth.signUp>(async (input) => {
    const r = await auth.signUp(input);
    if (r.ok) {
      const d = loadUserData(r.user.id);
      d.settings.theme = readTheme();
      d.meta.lastAutoReplanAt = new Date().toISOString();
      d.meta.onboarded = false;
      saveUserData(r.user.id, d);
      loadFor(r.user);
    }
    return r;
  }, [loadFor]);

  const logIn = useCallback<typeof auth.logIn>(async (input) => {
    const r = await auth.logIn(input);
    if (r.ok) loadFor(r.user);
    return r;
  }, [loadFor]);

  const logOut = useCallback(() => {
    if (userRef.current && dataRef.current) saveUserData(userRef.current.id, dataRef.current);
    auth.logOut();
    loadFor(null);
  }, [loadFor]);

  const refreshUser = useCallback(() => {
    if (userRef.current) setUser(usersRepo.byId(userRef.current.id) ?? null);
  }, []);

  const deleteAccount = useCallback(() => {
    if (!userRef.current) return;
    auth.deleteAccount(userRef.current.id);
    try {
      sessionStorage.setItem('nt-after-delete', '1');
    } catch {
      /* ignore */
    }
    setUser(null);
    dispatch({ type: 'load', data: null });
  }, []);

  // ---------- Settings ----------
  const setTheme = useCallback((t: Theme) => {
    applyTheme(t, true);
    setThemeState(t);
    if (dataRef.current) update((d) => ({ ...d, settings: { ...d.settings, theme: t } }));
  }, [update]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, [update]);

  // ---------- Projects ----------
  const createProject = useCallback((input: NewProjectInput): Project => {
    const d = dataRef.current!;
    const color = input.color ?? pickColor(d.projects);
    const p: Project = {
      id: uid('p_'), userId: d.settings.userId, name: input.name.trim(), color, priority: input.priority,
      dueDate: input.dueDate, createdAt: new Date().toISOString(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    };
    update((x) => ({ ...x, projects: [...x.projects, p] }));
    return p;
  }, [update]);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, [update]);

  const deleteProject = useCallback((id: string) => {
    update((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
      tasks: d.tasks.filter((t) => t.projectId !== id),
      sessions: d.sessions.map((s) => (s.projectId === id ? { ...s, projectId: undefined, taskId: undefined } : s)),
      meta: d.meta.timer && d.tasks.some((t) => t.projectId === id && t.id === d.meta.timer?.taskId) ? { ...d.meta, timer: undefined } : d.meta,
    }));
  }, [update]);

  // ---------- Tasks ----------
  const addTask = useCallback<AppStore['addTask']>((input) => {
    const d = dataRef.current!;
    const own = d.tasks.filter((t) => t.projectId === input.projectId);
    const t: Task = {
      id: uid('t_'), userId: d.settings.userId, projectId: input.projectId, section: input.section?.trim() || 'Inbox',
      title: input.title.trim(), estimateMin: Math.min(30, Math.max(5, input.estimateMin)), status: 'todo',
      order: own.length ? Math.max(...own.map((x) => x.order)) + 1 : 0, createdAt: new Date().toISOString(),
      ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    };
    update((x) => ({ ...x, tasks: [...x.tasks, t] }));
    return t;
  }, [update]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => {
        if (t.id !== id) return t;
        const n: Task = { ...t, ...patch };
        if (n.estimateMin != null) n.estimateMin = Math.min(30, Math.max(5, Math.round(n.estimateMin)));
        return n;
      }),
    }));
  }, [update]);

  const deleteTask = useCallback((id: string) => {
    update((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== id),
      meta: d.meta.timer?.taskId === id ? { ...d.meta, timer: { ...d.meta.timer, taskId: undefined } } : d.meta,
    }));
  }, [update]);

  const restoreTask = useCallback((task: Task) => {
    update((d) => (d.tasks.some((t) => t.id === task.id) || !d.projects.some((p) => p.id === task.projectId) ? d : { ...d, tasks: [...d.tasks, task] }));
  }, [update]);

  const moveTask = useCallback((id: string, dir: -1 | 1) => {
    update((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (!t) return d;
      const siblings = d.tasks.filter((x) => x.projectId === t.projectId && x.section === t.section).sort((a, b) => a.order - b.order);
      const i = siblings.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= siblings.length) return d;
      const other = siblings[j];
      return {
        ...d,
        tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, order: other.order } : x.id === other.id ? { ...x, order: t.order } : x)),
      };
    });
  }, [update]);

  const mapTask = useCallback((id: string, fn: (t: Task, now: Date) => Task) => {
    const n = new Date();
    update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? fn(t, n) : t)) }));
  }, [update]);

  const cycleStatus = useCallback((id: string) => mapTask(id, cycleTask), [mapTask]);
  const toggleTaskDone = useCallback((id: string) => mapTask(id, toggleDone), [mapTask]);
  const setStatus = useCallback((id: string, s: TaskStatus) => mapTask(id, (t, n) => withStatus(t, s, n)), [mapTask]);

  // ---------- Scheduling ----------
  const planMyDay = useCallback(() => {
    const d = dataRef.current!;
    const n = new Date();
    const active = new Set(d.projects.filter((p) => !p.completedAt).map((p) => p.id));
    const t0 = startOfDay(n).getTime();
    const toPlace = d.tasks.filter(
      (t) => active.has(t.projectId) && t.status !== 'done' && (!t.scheduledFor || new Date(t.scheduledFor).getTime() < t0),
    );
    const res = schedule(toPlace, d.settings, d.tasks, d.projects, n);
    const { tasks, undo } = applyPlacements(d.tasks, res.placements, true);
    update((x) => ({ ...x, tasks, meta: { ...x.meta, lastReplan: { at: n.toISOString(), entries: undo } } }));
    return { placed: res.placements.length, unplaced: res.unplaced.length };
  }, [update]);

  const applyReplan = useCallback((placements?: Placement[]) => {
    const d = dataRef.current!;
    const n = new Date();
    const preview = placements ?? replan({ tasks: d.tasks, projects: d.projects, settings: d.settings }, n);
    const { tasks, undo } = applyPlacements(d.tasks, preview, true);
    if (undo.length === 0) return 0;
    update((x) => ({ ...x, tasks, meta: { ...x.meta, lastReplan: { at: n.toISOString(), entries: undo } } }));
    return undo.length;
  }, [update]);

  const undoReplan = useCallback(() => {
    update((d) => {
      if (!d.meta.lastReplan) return d;
      return { ...d, tasks: revertPlacements(d.tasks, d.meta.lastReplan.entries), meta: { ...d.meta, lastReplan: undefined } };
    });
  }, [update]);

  const replanProject = useCallback((projectId: string) => {
    const d = dataRef.current!;
    const n = new Date();
    const t0 = startOfDay(n).getTime();
    const toPlace = d.tasks.filter(
      (t) => t.projectId === projectId && t.status !== 'done' && (!t.scheduledFor || new Date(t.scheduledFor).getTime() < t0),
    );
    const res = schedule(toPlace, d.settings, d.tasks, d.projects, n);
    const { tasks, undo } = applyPlacements(d.tasks, res.placements, true);
    update((x) => ({ ...x, tasks, meta: { ...x.meta, lastReplan: { at: n.toISOString(), entries: undo } } }));
    return { placed: res.placements.length, unplaced: res.unplaced.length };
  }, [update]);

  const replanProjectToToday = useCallback((projectId: string) => {
    const d = dataRef.current!;
    const n = new Date();
    const todayKey = dayKey(n);
    const toPlace = d.tasks.filter(
      (t) => t.projectId === projectId && t.status !== 'done' && !(t.scheduledFor && dayKey(new Date(t.scheduledFor)) === todayKey),
    );
    const res = schedule(toPlace, d.settings, d.tasks, d.projects, n, { onlyDay: n, ignoreDeadline: true });
    const { tasks, undo } = applyPlacements(d.tasks, res.placements, true);
    update((x) => ({
      ...x, tasks,
      meta: { ...x.meta, lastReplan: { at: n.toISOString(), entries: undo }, snoozedAlerts: { ...x.meta.snoozedAlerts, [projectId]: todayKey } },
    }));
    return { placed: res.placements.length, unplaced: res.unplaced.length };
  }, [update]);

  const pullIntoDay = useCallback((day: Date) => {
    const d = dataRef.current!;
    const n = new Date();
    const atRisk = new Set(
      [...derived.stats.entries()].filter(([id, s]) => (s.risk === 'at_risk' || s.risk === 'overdue') && d.projects.find((p) => p.id === id && !p.completedAt)).map(([id]) => id),
    );
    const dayStart = startOfDay(day).getTime();
    const candidates = d.tasks.filter(
      (t) => atRisk.has(t.projectId) && t.status !== 'done' && (!t.scheduledFor || new Date(t.scheduledFor).getTime() > dayStart + 86_400_000 - 1 || new Date(t.scheduledFor).getTime() < startOfDay(n).getTime()),
    );
    const res = schedule(candidates, d.settings, d.tasks, d.projects, n, { onlyDay: day, ignoreDeadline: true });
    const { tasks, undo } = applyPlacements(d.tasks, res.placements, true);
    if (undo.length) update((x) => ({ ...x, tasks, meta: { ...x.meta, lastReplan: { at: n.toISOString(), entries: undo } } }));
    return undo.length;
  }, [update, derived.stats]);

  const snoozeAlert = useCallback((projectId: string) => {
    update((d) => ({ ...d, meta: { ...d.meta, snoozedAlerts: { ...d.meta.snoozedAlerts, [projectId]: dayKey(new Date()) } } }));
  }, [update]);

  const markOnboarded = useCallback(() => {
    update((d) => ({ ...d, meta: { ...d.meta, onboarded: true } }));
  }, [update]);

  // ---------- Focus timer ----------
  const setTimer = useCallback((fn: (t: ReturnType<typeof T.newTimer>, d: AppData) => ReturnType<typeof T.newTimer> | undefined) => {
    update((d) => {
      const cur = d.meta.timer ?? T.newTimer(d.settings.defaultTaskMin === 10 ? 10 : 15);
      return { ...d, meta: { ...d.meta, timer: fn(cur, d) } };
    });
  }, [update]);

  const timerSetLength = useCallback((min: number) => setTimer((t) => (t.running ? t : T.setLength(t, min))), [setTimer]);
  const timerSelectTask = useCallback((taskId: string | undefined) => {
    setTimer((t, d) => {
      if (t.taskId === taskId) return t;
      const task = d.tasks.find((x) => x.id === taskId);
      const len = task ? (task.estimateMin >= 20 ? 25 : task.estimateMin <= 10 ? 10 : 15) : t.lengthMs / 60_000;
      return { ...T.newTimer(len, taskId) };
    });
  }, [setTimer]);

  const timerStart = useCallback(() => {
    const n = Date.now();
    update((d) => {
      const cur = d.meta.timer ?? T.newTimer(d.settings.defaultTaskMin === 10 ? 10 : 15);
      const tasks = cur.taskId ? d.tasks.map((t) => (t.id === cur.taskId ? startTask(t, new Date(n)) : t)) : d.tasks;
      return { ...d, tasks, meta: { ...d.meta, timer: T.start(cur, n) } };
    });
  }, [update]);
  const timerPause = useCallback(() => setTimer((t) => T.pause(t, Date.now())), [setTimer]);
  const timerReset = useCallback(() => setTimer((t) => T.reset(t)), [setTimer]);
  const timerExtend = useCallback(() => setTimer((t) => T.extend(t, Date.now())), [setTimer]);

  const completedRef = useRef('');
  const timerComplete = useCallback((byTimer = false) => {
    const d = dataRef.current;
    if (!d) return;
    const n = Date.now();
    const cur = d.meta.timer ?? T.newTimer(15);
    // A finished timer must only be completed once (the watcher can fire again before state settles).
    const key = `${cur.taskId ?? ''}:${cur.firstStartedAt ?? ''}:${cur.lengthMs}:${cur.endsAt ?? cur.remainingMs}`;
    if (completedRef.current === key) return;
    completedRef.current = key;
    const elapsed = byTimer ? cur.lengthMs : T.elapsedMs(cur, n);
    const minutes = Math.round(elapsed / 60_000);
    const task = cur.taskId ? d.tasks.find((t) => t.id === cur.taskId) : undefined;
    const nowDate = new Date(n);

    // Next task in today's queue (time order), skipping the one just finished.
    const todayKey = dayKey(nowDate);
    const queue = d.tasks
      .filter((t) => t.scheduledFor && dayKey(new Date(t.scheduledFor)) === todayKey && t.status !== 'done' && t.id !== task?.id)
      .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
    const next = queue[0];

    update((x) => {
      const sessions: FocusSession[] = [...x.sessions];
      if (elapsed >= 30_000) {
        const startedAt = cur.firstStartedAt ? new Date(cur.firstStartedAt) : new Date(n - elapsed);
        sessions.push({
          id: uid('s_'), userId: x.settings.userId, taskId: task?.id, projectId: task?.projectId,
          startedAt: startedAt.toISOString(), endedAt: nowDate.toISOString(), minutes: Math.max(1, minutes), completedTask: !!task,
        });
      }
      const tasks = task ? x.tasks.map((t) => (t.id === task.id ? withStatus(t, 'done', nowDate) : t)) : x.tasks;
      const len = next ? (next.estimateMin >= 20 ? 25 : next.estimateMin <= 10 ? 10 : 15) : cur.lengthMs / 60_000;
      return { ...x, sessions, tasks, meta: { ...x.meta, timer: T.newTimer(Math.min(25, Math.max(10, len)), next?.id) } };
    });

    if (d.settings.focusSound && byTimer) chime();
    toast({
      tone: 'ok',
      title: task ? `Done: ${task.title}` : 'Session complete',
      body: [elapsed >= 30_000 ? `${Math.max(1, minutes)} min logged` : 'Under a minute, not logged', next ? `Up next: ${next.title}` : 'Queue is clear'].join(' · '),
    });
  }, [update, toast]);

  // Global timer watcher: completes sessions even when the Focus page is closed.
  const timer = data?.meta.timer;
  useEffect(() => {
    if (!timer?.running || timer.endsAt == null) return;
    const check = () => {
      const t = dataRef.current?.meta.timer;
      if (t && T.isFinished(t, Date.now())) timerComplete(true);
    };
    check();
    const id = window.setInterval(check, 500);
    return () => window.clearInterval(id);
  }, [timer?.running, timer?.endsAt, timerComplete]);

  const addParking = useCallback((text: string) => {
    const v = text.trim();
    if (!v) return;
    update((d) => ({ ...d, meta: { ...d.meta, parking: [...d.meta.parking, { id: uid('n_'), text: v, createdAt: new Date().toISOString() }] } }));
  }, [update]);
  const removeParking = useCallback((id: string) => {
    update((d) => ({ ...d, meta: { ...d.meta, parking: d.meta.parking.filter((x) => x.id !== id) } }));
  }, [update]);

  // ---------- Auto-replan & alerts ----------
  const lastCheck = useRef('');
  useEffect(() => {
    const d = dataRef.current;
    if (!d || !user) return;
    // Guard against double invocation (React StrictMode) for the same tick.
    const key = `${user.id}:${now.getTime()}`;
    if (lastCheck.current === key) return;
    lastCheck.current = key;
    // Nightly auto-replan (22:00 local), applied on load if the last run was before the latest 22:00.
    if (d.settings.autoReplan && autoReplanDue(d.meta.lastAutoReplanAt, now)) {
      const preview = replan({ tasks: d.tasks, projects: d.projects, settings: d.settings }, now);
      const movable = preview.filter((p) => p.to);
      const { tasks, undo } = applyPlacements(d.tasks, movable, true);
      update((x) => ({
        ...x,
        tasks: undo.length ? tasks : x.tasks,
        meta: { ...x.meta, lastAutoReplanAt: now.toISOString(), ...(undo.length ? { lastReplan: { at: now.toISOString(), entries: undo } } : {}) },
      }));
      if (undo.length) {
        toast({
          title: `Auto-replan moved ${undo.length} unfinished ${undo.length === 1 ? 'task' : 'tasks'}`,
          body: 'They’re now in free slots before their deadlines.',
          action: { label: 'Undo', onClick: () => undoReplan() },
        });
      }
    }
    // Deadline alerts: 3 days, 1 day, 2 hours before, plus overdue. Each one once.
    if (d.settings.deadlineAlerts) {
      const active = d.projects.filter((p) => !p.completedAt);
      const pending = pendingAlerts(active, d.tasks, d.meta.shownAlerts, now);
      if (pending.length) {
        pending.slice(0, 3).forEach((a) => {
          toast({ tone: a.tone, title: a.title, body: a.body });
          try {
            if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              new Notification(a.title, { body: a.body, tag: a.key });
            }
          } catch {
            /* ignore */
          }
        });
        update((x) => ({ ...x, meta: { ...x.meta, shownAlerts: [...x.meta.shownAlerts, ...pending.map((a) => a.key)] } }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, now]);

  const store: AppStore = {
    ready: true,
    user, data, now, theme,
    activeProjects: derived.activeProjects,
    stats: derived.stats,
    tasksOf: (id) => derived.byProject.get(id) ?? [],
    projectById: (id) => data?.projects.find((p) => p.id === id),
    todayTasks: derived.todayTasks,
    todayFocusMin: derived.todayFocusMin,
    todaySessions: derived.todaySessions,
    replanPreview: derived.replanPreview,
    signUp, logIn, logOut, refreshUser, deleteAccount,
    setTheme, updateSettings,
    createProject, updateProject, deleteProject,
    addTask, updateTask, deleteTask, restoreTask, moveTask, cycleStatus, toggleTaskDone, setStatus,
    planMyDay, applyReplan, undoReplan, replanProject, replanProjectToToday, pullIntoDay, snoozeAlert, markOnboarded,
    timerSetLength, timerSelectTask, timerStart, timerPause, timerReset, timerExtend, timerComplete,
    addParking, removeParking,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

/** First palette color not used by an active project. */
export function pickColor(projects: Project[]): string {
  const used = new Set(projects.filter((p) => !p.completedAt).map((p) => p.color));
  return PROJECT_COLORS.find((c) => !used.has(c)) ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
}

/** Helpers used across pages. */
export function slippedCount(tasks: Task[], now: Date) {
  return slippedTasks(tasks, now).length;
}

export function tomorrowAt(now: Date, hh = 9) {
  const d = addDays(startOfDay(now), 1);
  d.setHours(hh, 0, 0, 0);
  return d;
}
