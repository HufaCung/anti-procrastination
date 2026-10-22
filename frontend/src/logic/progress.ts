import type { FocusSession, Project, Risk, Task } from '../data/types';
import { addDays, dayKey, daysBetween, dueEnd, fmt, parseDay, startOfDay } from './dates';

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
  reasons: string[];
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
  const own = sessions.filter((s) => s.projectId === projectId);
  if (own.length === 0) return { pace: 0, hasHistory: false };
  const from = startOfDay(addDays(now, -6)).getTime();
  const to = now.getTime();
  const mins = own
    .filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= from && t <= to;
    })
    .reduce((sum, s) => sum + s.minutes, 0);
  return { pace: mins / 7, hasHistory: true };
}

function joinHuman(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
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
  const reasons: string[] = [];

  if (allDone) {
    risk = 'done';
  } else if (now.getTime() > due.getTime()) {
    risk = 'overdue';
    const open = total - done;
    reasons.push(`The deadline was ${fmt.dowMonthDay(parseDay(project.dueDate))}; ${open} ${open === 1 ? 'task is' : 'tasks are'} still open.`);
    if (slipped.length) reasons.push(`${slipped.length} ${slipped.length === 1 ? 'task' : 'tasks'} slipped from earlier days.`);
  } else {
    const lateFinish = projectedFinish.getTime() > due.getTime();
    const tooSlow = neededPerDay > 1.2 * pace;
    const hasSlipped = slipped.length > 0;
    const shortfall = (input.unplacedCount ?? 0) > 0;
    risk = lateFinish || tooSlow || hasSlipped || shortfall ? 'at_risk' : 'on_track';

    if (hasSlipped) {
      const days = Array.from(new Set(slipped.map((t) => dayKey(new Date(t.scheduledFor!))))).sort();
      const label = days.length <= 3 ? joinHuman(days.map((k) => fmt.dow(parseDay(k)))) : 'earlier days';
      reasons.push(`${slipped.length} ${slipped.length === 1 ? 'task' : 'tasks'} slipped from ${label}.`);
    }
    if (tooSlow) {
      reasons.push(`Your pace (${Math.round(pace)} min/day) is below the ${Math.round(neededPerDay)} min/day needed.`);
    }
    if (lateFinish) {
      reasons.push(`At this pace it finishes ${fmt.monthDay(projectedFinish)}, ${daysLate} ${daysLate === 1 ? 'day' : 'days'} after the deadline.`);
    }
    if (shortfall) {
      const n = input.unplacedCount!;
      reasons.push(`${n} ${n === 1 ? 'task doesn’t' : 'tasks don’t'} fit in your daily focus goal before the deadline.`);
    }
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
      if (empty.length === 1) reasons.push(`No sessions scheduled on ${fmt.dowMonthDay(empty[0])}.`);
      else if (empty.length === 2) reasons.push(`No sessions scheduled on ${fmt.dowMonthDay(empty[0])} or ${fmt.dowMonthDay(empty[1])}.`);
      else if (empty.length >= 3) reasons.push(`Several days before the deadline have no sessions scheduled, starting ${fmt.dowMonthDay(empty[0])}.`);
    }
  }

  return {
    total, done, pct, remainingMin, focusMin,
    pace, paceIsFallback: !hasHistory,
    daysLeft, neededPerDay, projectedFinish, daysLate,
    slipped, risk, reasons,
  };
}

export const RISK_LABEL: Record<Risk, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  overdue: 'Overdue',
  done: 'Done',
};

export const PRIORITY_LABEL = { low: 'Low priority', medium: 'Medium priority', high: 'High priority' } as const;
export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
