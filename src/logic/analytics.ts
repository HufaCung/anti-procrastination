import type { FocusSession, Project, Task } from '../data/types';
import { addDays, dayKey, dueEnd, parseDay, startOfDay, startOfWeek } from './dates';

export function focusByDay(sessions: FocusSession[], from: Date, days: number): number[] {
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) idx.set(dayKey(addDays(from, i)), i);
  const out = new Array(days).fill(0);
  for (const s of sessions) {
    const i = idx.get(dayKey(new Date(s.startedAt)));
    if (i != null) out[i] += s.minutes;
  }
  return out;
}

export function completedByDay(tasks: Task[], from: Date, days: number): number[] {
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) idx.set(dayKey(addDays(from, i)), i);
  const out = new Array(days).fill(0);
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const i = idx.get(dayKey(new Date(t.completedAt)));
    if (i != null) out[i] += 1;
  }
  return out;
}

/** Heatmap level 0–4 by quartiles of the non-zero counts. */
export function heatLevels(counts: number[]): number[] {
  const nz = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nz.length === 0) return counts.map(() => 0);
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * (nz.length - 1)))];
  const q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
  return counts.map((c) => {
    if (c <= 0) return 0;
    if (c <= q1) return 1;
    if (c <= q2) return 2;
    if (c <= q3) return 3;
    return 4;
  });
}

/** Consecutive days with ≥ 1 completed task, ending today or yesterday. */
export function streak(tasks: Task[], now: Date): number {
  const days = new Set(
    tasks.filter((t) => t.status === 'done' && t.completedAt).map((t) => dayKey(new Date(t.completedAt!))),
  );
  let d = startOfDay(now);
  if (!days.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function avgSession(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;
  return sessions.reduce((s, x) => s + x.minutes, 0) / sessions.length;
}

export function inRange<T>(items: T[], get: (x: T) => string | undefined, from: Date, toExcl: Date): T[] {
  const a = from.getTime(), b = toExcl.getTime();
  return items.filter((x) => {
    const v = get(x);
    if (!v) return false;
    const t = new Date(v).getTime();
    return t >= a && t < b;
  });
}

/**
 * On-time rate = projects completed on or before their due date ÷ projects due in the range.
 * Only deadlines that have already passed (or were completed) count.
 */
export function onTimeRate(projects: Project[], tasksByProject: Map<string, Task[]>, from: Date, toExcl: Date, now: Date) {
  const due = projects.filter((p) => {
    const d = parseDay(p.dueDate).getTime();
    return d >= from.getTime() && d < toExcl.getTime();
  });
  const settled = due.filter((p) => isComplete(p, tasksByProject.get(p.id) ?? []) || dueEnd(p.dueDate).getTime() < now.getTime());
  const onTime = settled.filter((p) => {
    const doneAt = completionTime(p, tasksByProject.get(p.id) ?? []);
    return doneAt != null && doneAt <= dueEnd(p.dueDate).getTime();
  });
  return { total: settled.length, onTime: onTime.length, missed: settled.length - onTime.length, rate: settled.length ? onTime.length / settled.length : null };
}

export function isComplete(p: Project, tasks: Task[]): boolean {
  return !!p.completedAt || (tasks.length > 0 && tasks.every((t) => t.status === 'done'));
}

export function completionTime(p: Project, tasks: Task[]): number | null {
  if (p.completedAt) return new Date(p.completedAt).getTime();
  if (tasks.length === 0 || tasks.some((t) => t.status !== 'done')) return null;
  return Math.max(...tasks.map((t) => (t.completedAt ? new Date(t.completedAt).getTime() : 0)));
}

export interface RangeKpis {
  from: Date;
  toExcl: Date;
  days: number;
  tasksCompleted: number;
  tasksCompletedPrev: number;
  focusMin: number;
  focusMinPrev: number;
  avgSessionMin: number;
  sessionsCount: number;
  onTime: ReturnType<typeof onTimeRate>;
  focusPerDay: number[];
}

export function rangeKpis(
  data: { tasks: Task[]; sessions: FocusSession[]; projects: Project[] },
  days: number,
  now: Date,
): RangeKpis {
  const toExcl = addDays(startOfDay(now), 1);
  const from = addDays(toExcl, -days);
  const prevFrom = addDays(from, -days);
  const doneTasks = data.tasks.filter((t) => t.status === 'done');
  const sessionsIn = inRange(data.sessions, (s) => s.startedAt, from, toExcl);
  const sessionsPrev = inRange(data.sessions, (s) => s.startedAt, prevFrom, from);
  const byProject = new Map<string, Task[]>();
  data.tasks.forEach((t) => {
    const arr = byProject.get(t.projectId) ?? [];
    arr.push(t);
    byProject.set(t.projectId, arr);
  });
  return {
    from, toExcl, days,
    tasksCompleted: inRange(doneTasks, (t) => t.completedAt, from, toExcl).length,
    tasksCompletedPrev: inRange(doneTasks, (t) => t.completedAt, prevFrom, from).length,
    focusMin: sessionsIn.reduce((s, x) => s + x.minutes, 0),
    focusMinPrev: sessionsPrev.reduce((s, x) => s + x.minutes, 0),
    avgSessionMin: avgSession(sessionsIn),
    sessionsCount: sessionsIn.length,
    onTime: onTimeRate(data.projects, byProject, from, toExcl, now),
    focusPerDay: focusByDay(data.sessions, from, days),
  };
}

/** 12-week heatmap cells, oldest first, column-major (each column is one week). */
export function heatmap(tasks: Task[], now: Date, weekStart: 'mon' | 'sun', weeks = 12) {
  const first = addDays(startOfWeek(now, weekStart), -7 * (weeks - 1));
  const total = weeks * 7;
  const counts = completedByDay(tasks, first, total);
  const levels = heatLevels(counts);
  const todayKey = dayKey(now);
  return counts.map((c, i) => {
    const d = addDays(first, i);
    return { date: d, count: c, level: levels[i], future: d.getTime() > now.getTime() && dayKey(d) !== todayKey, today: dayKey(d) === todayKey };
  });
}
