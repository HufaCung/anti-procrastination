import type { Project, Settings, Task } from '../data/types';
import { addDays, dayKey, daysBetween, parseDay, startOfDay } from './dates';
import { PRIORITY_RANK } from './progress';

export const DAY_START_MIN = 9 * 60; // 09:00
export const DAY_END_MIN = 22 * 60; // last slot must end by 22:00
export const GAP_MIN = 5;
const MAX_DAYS = 120;

export interface Placement {
  taskId: string;
  from?: string; // previous scheduledFor
  to?: string; // new scheduledFor (undefined = did not fit)
}

export interface ScheduleResult {
  placements: Placement[]; // placed tasks
  unplaced: string[]; // task ids that did not fit before their deadline
}

interface DayState {
  used: number; // minutes already scheduled that day
  lastEnd: number; // minutes since midnight of the latest slot end
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function roundUp5(min: number): number {
  return Math.ceil(min / 5) * 5;
}

/** Sort: earliest due date first, then priority, then section order, then task order. */
export function sortForScheduling(tasks: Task[], projects: Project[], allTasks: Task[]): Task[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  // Section order = first appearance by task.order within the project.
  const sectionRank = new Map<string, number>();
  [...allTasks]
    .sort((a, b) => a.order - b.order)
    .forEach((t) => {
      const k = `${t.projectId}::${t.section}`;
      if (!sectionRank.has(k)) sectionRank.set(k, sectionRank.size);
    });
  return [...tasks].sort((a, b) => {
    const pa = byId.get(a.projectId);
    const pb = byId.get(b.projectId);
    const da = [pa?.dueDate, a.dueDate].filter(Boolean).sort()[0] ?? '9999-12-31';
    const db = [pb?.dueDate, b.dueDate].filter(Boolean).sort()[0] ?? '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    const ra = pa ? PRIORITY_RANK[pa.priority] : 3;
    const rb = pb ? PRIORITY_RANK[pb.priority] : 3;
    if (ra !== rb) return ra - rb;
    const sa = sectionRank.get(`${a.projectId}::${a.section}`) ?? 0;
    const sb = sectionRank.get(`${b.projectId}::${b.section}`) ?? 0;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });
}

export interface ScheduleOptions {
  /** Restrict placement to this single day (e.g. "Replan to today"). */
  onlyDay?: Date;
  /** Ignore the project's due date (used when pulling work forward). */
  ignoreDeadline?: boolean;
}

/**
 * Places `toPlace` tasks into daily capacity (dailyGoalMin minus already-scheduled minutes),
 * starting today. Never after the project's due date (overdue projects may use today only).
 * Slots start at 09:00 and are packed back-to-back with 5-minute gaps.
 */
export function schedule(
  toPlace: Task[],
  settings: Pick<Settings, 'dailyGoalMin'>,
  existing: Task[],
  projects: Project[],
  now: Date,
  opts: ScheduleOptions = {},
): ScheduleResult {
  const placingIds = new Set(toPlace.map((t) => t.id));
  const days = new Map<string, DayState>();
  for (const t of existing) {
    if (!t.scheduledFor || placingIds.has(t.id)) continue;
    const s = new Date(t.scheduledFor);
    const k = dayKey(s);
    const st = days.get(k) ?? { used: 0, lastEnd: 0 };
    st.used += t.estimateMin;
    st.lastEnd = Math.max(st.lastEnd, minutesOfDay(s) + t.estimateMin);
    days.set(k, st);
  }

  const today = startOfDay(now);
  const nowMin = roundUp5(minutesOfDay(now));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const ordered = sortForScheduling(toPlace, projects, existing.concat(toPlace.filter((t) => !existing.includes(t))));
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  for (const task of ordered) {
    const project = projectById.get(task.projectId);
    if (!opts.ignoreDeadline && task.dueDate && parseDay(task.dueDate).getTime() < (opts.onlyDay ? startOfDay(opts.onlyDay) : today).getTime()) {
      unplaced.push(task.id);
      continue;
    }
    let lastDay: Date;
    if (opts.onlyDay) {
      lastDay = startOfDay(opts.onlyDay);
    } else if (!project || opts.ignoreDeadline) {
      lastDay = addDays(today, MAX_DAYS);
    } else {
      const due = parseDay(task.dueDate && task.dueDate < project.dueDate ? task.dueDate : project.dueDate);
      lastDay = due.getTime() < today.getTime() ? today : due;
    }
    const firstDay = opts.onlyDay ? startOfDay(opts.onlyDay) : today;
    if (firstDay.getTime() < today.getTime()) {
      unplaced.push(task.id);
      continue;
    }
    const span = Math.min(MAX_DAYS, daysBetween(firstDay, lastDay));
    let placed = false;
    for (let i = 0; i <= span; i++) {
      const day = addDays(firstDay, i);
      const k = dayKey(day);
      const st = days.get(k) ?? { used: 0, lastEnd: 0 };
      if (st.used + task.estimateMin > settings.dailyGoalMin) continue;
      let start = Math.max(DAY_START_MIN, st.lastEnd > 0 ? st.lastEnd + GAP_MIN : 0);
      if (daysBetween(today, day) === 0) start = Math.max(start, nowMin);
      start = roundUp5(start);
      if (start + task.estimateMin > DAY_END_MIN) continue;
      const when = new Date(day);
      when.setHours(0, start, 0, 0);
      st.used += task.estimateMin;
      st.lastEnd = start + task.estimateMin;
      days.set(k, st);
      placements.push({ taskId: task.id, from: task.scheduledFor, to: when.toISOString() });
      placed = true;
      break;
    }
    if (!placed) unplaced.push(task.id);
  }
  return { placements, unplaced };
}

/** Unfinished tasks whose slot is before today. */
export function slippedTasks(tasks: Task[], now: Date): Task[] {
  const t0 = startOfDay(now).getTime();
  return tasks.filter((t) => t.status !== 'done' && t.scheduledFor && new Date(t.scheduledFor).getTime() < t0);
}

/**
 * Auto-replan preview: reschedules slipped tasks. Returns one entry per slipped task
 * with from/to (to undefined when it no longer fits before its deadline).
 */
export function replan(
  state: { tasks: Task[]; projects: Project[]; settings: Pick<Settings, 'dailyGoalMin'> },
  now: Date,
): Placement[] {
  const slipped = slippedTasks(state.tasks, now);
  if (slipped.length === 0) return [];
  const res = schedule(slipped, state.settings, state.tasks, state.projects, now);
  const placed = new Map(res.placements.map((p) => [p.taskId, p]));
  return sortForScheduling(slipped, state.projects, state.tasks).map(
    (t) => placed.get(t.id) ?? { taskId: t.id, from: t.scheduledFor, to: undefined },
  );
}

/** Apply placements to the task list. Returns the new list plus an undo record. */
export function applyPlacements(
  tasks: Task[],
  placements: Placement[],
  markReplanned: boolean,
): { tasks: Task[]; undo: { taskId: string; scheduledFor?: string; replannedFrom?: string }[] } {
  const map = new Map(placements.filter((p) => p.to).map((p) => [p.taskId, p]));
  const undo: { taskId: string; scheduledFor?: string; replannedFrom?: string }[] = [];
  const next = tasks.map((t) => {
    const p = map.get(t.id);
    if (!p) return t;
    undo.push({ taskId: t.id, scheduledFor: t.scheduledFor, replannedFrom: t.replannedFrom });
    const n: Task = { ...t, scheduledFor: p.to };
    if (markReplanned && t.scheduledFor) n.replannedFrom = t.scheduledFor;
    return n;
  });
  return { tasks: next, undo };
}

export function revertPlacements(
  tasks: Task[],
  undo: { taskId: string; scheduledFor?: string; replannedFrom?: string }[],
): Task[] {
  const map = new Map(undo.map((u) => [u.taskId, u]));
  return tasks.map((t) => {
    const u = map.get(t.id);
    if (!u) return t;
    const n: Task = { ...t, scheduledFor: u.scheduledFor, replannedFrom: u.replannedFrom };
    if (!n.scheduledFor) delete n.scheduledFor;
    if (!n.replannedFrom) delete n.replannedFrom;
    return n;
  });
}

/** Most recent 22:00 local at or before `now`. */
export function lastNightlyRun(now: Date): Date {
  const d = new Date(now);
  d.setHours(22, 0, 0, 0);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

/** Whether nightly auto-replan should run now. */
export function autoReplanDue(lastRunIso: string | undefined, now: Date): boolean {
  if (!lastRunIso) return true;
  return new Date(lastRunIso).getTime() < lastNightlyRun(now).getTime();
}
