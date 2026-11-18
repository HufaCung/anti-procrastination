import type { FocusSession, Project, Risk, Task } from '../data/types';
import { addDays, dayKey, daysBetween, dueEnd, parseDay, startOfDay } from './dates';

export type RiskReason =
  | { kind: 'overdue'; due: Date; count: number }
  | { kind: 'slipped'; count: number; dates: Date[] }
  | { kind: 'pace'; actual: number; needed: number }
  | { kind: 'late'; finish: Date; days: number }
  | { kind: 'unplaced'; count: number }
  | { kind: 'empty'; dates: Date[] };

export interface ProjectStats {
  total: number;
  done: number;
  pct: number; // 0–100, floored so 100 only when everything is done
  remainingMin: number;
  focusMin: number; // all-time focus logged on the project
  pace: number; // min/day, last 7 days (or fallback)
  paceIsFallback: boolean;
  daysLeft: number; // calendar days left including today (0 when overdue)
  neededPerDay: number;
  projectedFinish: Date;
  daysLate: number; // projected finish vs due date (positive = late)
  slipped: Task[]; // unfinished tasks scheduled before today
  risk: Risk;
  reasons: RiskReason[];
}

export interface StatsInput {
  project: Project;
  tasks: Task[]; // tasks of this project
  sessions: FocusSession[]; // sessions (any project; filtered here)
  dailyGoalMin: number;
  activeProjectsCount: number;
  now: Date;
  /** Tasks the scheduler could not place before the due date. */
  unplacedCount?: number;
}

export function progressOf(tasks: Task[]): { total: number; done: number; pct: number; remainingMin: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const pct = total ? Math.floor((done / total) * 100) : 0;
  const remainingMin = tasks.filter((t) => t.status !== 'done').reduce((s, t) => s + (Number(t.estimateMin) || 0), 0);
  return { total, done, pct, remainingMin };
}

/** Average focus minutes per day on the project over the last 7 days (today included, zero days count). */
export function paceOf(projectId: string, sessions: FocusSession[], now: Date): { pace: number; hasHistory: boolean } {
  const from = startOfDay(addDays(now, -6)).getTime();
  const to = now.getTime();
  const recent = sessions.filter((s) => {
    const started = new Date(s.startedAt).getTime();
    return s.projectId === projectId && started >= from && started <= to;
  });
  const minutes = recent.reduce((sum, s) => sum + s.minutes, 0);
  return { pace: minutes / 7, hasHistory: recent.length > 0 };
}

export function projectStats(input: StatsInput): ProjectStats {
  const { project, tasks, sessions, dailyGoalMin, activeProjectsCount, now } = input;
  const { total, done, pct, remainingMin } = progressOf(tasks);
  const focusMin = sessions.filter((s) => s.projectId === project.id).reduce((s, x) => s + x.minutes, 0);

  const { pace: rawPace, hasHistory } = paceOf(project.id, sessions, now);
  const fallback = dailyGoalMin / Math.max(1, activeProjectsCount);
  const pace = hasHistory ? rawPace : fallback;

  const due = dueEnd(project.dueDate);
  const today = startOfDay(now);
  const daysLeft = Math.max(0, daysBetween(today, parseDay(project.dueDate)) + 1);
  const neededPerDay = remainingMin / Math.max(1, daysLeft);
  const projectedFinish = addDays(today, remainingMin > 0 ? Math.ceil(remainingMin / Math.max(pace, 1)) : 0);
  const daysLate = daysBetween(parseDay(project.dueDate), projectedFinish);

  const slipped = tasks.filter(
    (t) => t.status !== 'done' && t.scheduledFor && new Date(t.scheduledFor).getTime() < today.getTime(),
  );

  const allDone = total > 0 && done === total;
  let risk: Risk;
  const reasons: RiskReason[] = [];

  if (allDone) {
    risk = 'done';
  } else if (now.getTime() > due.getTime()) {
    risk = 'overdue';
    reasons.push({ kind: 'overdue', due: parseDay(project.dueDate), count: total - done });
    if (slipped.length) reasons.push({ kind: 'slipped', count: slipped.length, dates: [] });
  } else {
    const lateFinish = projectedFinish.getTime() > due.getTime();
    const tooSlow = neededPerDay > 1.2 * pace;
    const hasSlipped = slipped.length > 0;
    const shortfall = (input.unplacedCount ?? 0) > 0;
    risk = lateFinish || tooSlow || hasSlipped || shortfall ? 'at_risk' : 'on_track';

    if (hasSlipped) {
      const days = Array.from(new Set(slipped.map((t) => dayKey(new Date(t.scheduledFor!))))).sort();
      reasons.push({ kind: 'slipped', count: slipped.length, dates: days.length <= 3 ? days.map(parseDay) : [] });
    }
    if (tooSlow) reasons.push({ kind: 'pace', actual: Math.round(pace), needed: Math.round(neededPerDay) });
    if (lateFinish) reasons.push({ kind: 'late', finish: projectedFinish, days: daysLate });
    if (input.unplacedCount) reasons.push({ kind: 'unplaced', count: input.unplacedCount });
    if (risk === 'at_risk') {
      // Supplementary: upcoming days with nothing scheduled for this project.
      const scheduledDays = new Set(
        tasks.filter((t) => t.status !== 'done' && t.scheduledFor).map((t) => dayKey(new Date(t.scheduledFor!))),
      );
      const empty: Date[] = [];
      for (let i = 0; i < daysLeft && empty.length < 3; i++) {
        const d = addDays(today, i);
        if (!scheduledDays.has(dayKey(d))) empty.push(d);
      }
      if (empty.length) reasons.push({ kind: 'empty', dates: empty });
    }
  }

  return {
    total, done, pct, remainingMin, focusMin,
    pace, paceIsFallback: !hasHistory,
    daysLeft, neededPerDay, projectedFinish, daysLate,
    slipped, risk, reasons,
  };
}

export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
