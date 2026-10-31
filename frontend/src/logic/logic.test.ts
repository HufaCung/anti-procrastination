import { describe, expect, it } from 'vitest';
import type { FocusSession, Project, Task } from '../data/types';
import { addDays, dayKey, daysBetween, fmtMinutes, relDue, startOfWeek } from './dates';
import { cycleTask, nextStatus, startTask, toggleDone } from './status';
import { paceOf, progressOf, projectStats } from './progress';
import { applyPlacements, autoReplanDue, lastNightlyRun, replan, revertPlacements, schedule } from './schedule';
import * as T from './timer';
import { heatLevels, onTimeRate, rangeKpis, streak } from './analytics';
import { alertKind, pendingAlerts } from './alerts';
import { passwordScore } from '../data/auth';
import { buildSeed } from '../../tests/fixtures/seed';

// Thu, Oct 22, 2026 14:00 local
const NOW = new Date(2026, 9, 22, 14, 0, 0);

let n = 0;
function task(p: Partial<Task> = {}): Task {
  n++;
  return { id: `t${n}`, userId: 'u', projectId: 'p1', section: 'S', title: `Task ${n}`, estimateMin: 15, status: 'todo', order: n, createdAt: NOW.toISOString(), ...p };
}
function project(p: Partial<Project> = {}): Project {
  return { id: 'p1', userId: 'u', name: 'P', color: '#000', priority: 'medium', dueDate: dayKey(addDays(NOW, 8)), createdAt: NOW.toISOString(), ...p };
}
function session(minutes: number, daysAgo: number, projectId = 'p1'): FocusSession {
  const d = addDays(NOW, -daysAgo);
  d.setHours(10);
  return { id: `s${Math.random()}`, userId: 'u', projectId, startedAt: d.toISOString(), endedAt: d.toISOString(), minutes, completedTask: false };
}

describe('dates', () => {
  it('formats minutes', () => {
    expect(fmtMinutes(95)).toBe('1h 35m');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(120)).toBe('2h');
  });
  it('relative due labels', () => {
    expect(relDue(dayKey(NOW), NOW)).toBe('Today');
    expect(relDue(dayKey(addDays(NOW, 5)), NOW)).toBe('In 5 days');
    expect(relDue(dayKey(addDays(NOW, -1)), NOW)).toBe('Yesterday');
  });
  it('week start', () => {
    expect(dayKey(startOfWeek(NOW, 'mon'))).toBe('2026-10-19');
    expect(dayKey(startOfWeek(NOW, 'sun'))).toBe('2026-10-18');
  });
  it('days between ignores time and DST', () => {
    expect(daysBetween(new Date(2026, 9, 22, 23, 0), new Date(2026, 9, 23, 1, 0))).toBe(1);
  });
});

describe('status transitions', () => {
  it('cycles todo → in_progress → done → todo with completedAt', () => {
    expect(nextStatus('todo')).toBe('in_progress');
    const t1 = cycleTask(task(), NOW);
    expect(t1.status).toBe('in_progress');
    const t2 = cycleTask(t1, NOW);
    expect(t2.status).toBe('done');
    expect(t2.completedAt).toBe(NOW.toISOString());
    const t3 = cycleTask(t2, NOW);
    expect(t3.status).toBe('todo');
    expect(t3.completedAt).toBeUndefined();
  });
  it('checkbox toggles done ↔ todo', () => {
    const t = toggleDone(task({ status: 'in_progress' }), NOW);
    expect(t.status).toBe('done');
    expect(toggleDone(t, NOW).status).toBe('todo');
  });
  it('starting focus moves todo to in_progress only', () => {
    expect(startTask(task(), NOW).status).toBe('in_progress');
    expect(startTask(task({ status: 'done' }), NOW).status).toBe('done');
  });
});

describe('progress and risk', () => {
  it('progress and remaining minutes', () => {
    const r = progressOf([task({ status: 'done' }), task({ estimateMin: 10 }), task({ estimateMin: 15 })]);
    expect(r).toEqual({ total: 3, done: 1, pct: 33, remainingMin: 25 });
  });
  it('pace counts zero days over 7 days', () => {
    const { pace, hasHistory } = paceOf('p1', [session(70, 0), session(70, 3), session(100, 9)], NOW);
    expect(hasHistory).toBe(true);
    expect(pace).toBe(20);
  });
  it('falls back to goal / active projects with no history', () => {
    const st = projectStats({ project: project(), tasks: [task()], sessions: [], dailyGoalMin: 180, activeProjectsCount: 3, now: NOW });
    expect(st.pace).toBe(60);
    expect(st.paceIsFallback).toBe(true);
    expect(st.risk).toBe('on_track');
  });
  it('needed/day and projected finish', () => {
    const tasks = Array.from({ length: 8 }, () => task({ estimateMin: 15 })); // 120 min
    const st = projectStats({ project: project({ dueDate: dayKey(addDays(NOW, 2)) }), tasks, sessions: [session(70, 1)], dailyGoalMin: 180, activeProjectsCount: 1, now: NOW });
    expect(st.daysLeft).toBe(3);
    expect(st.neededPerDay).toBe(40);
    expect(st.pace).toBe(10);
    expect(dayKey(st.projectedFinish)).toBe(dayKey(addDays(NOW, 12)));
    expect(st.risk).toBe('at_risk');
    expect(st.reasons.some((r) => r.includes('below'))).toBe(true);
  });
  it('overdue and done', () => {
    const over = projectStats({ project: project({ dueDate: dayKey(addDays(NOW, -1)) }), tasks: [task()], sessions: [], dailyGoalMin: 180, activeProjectsCount: 1, now: NOW });
    expect(over.risk).toBe('overdue');
    const done = projectStats({ project: project({ dueDate: dayKey(addDays(NOW, -1)) }), tasks: [task({ status: 'done' })], sessions: [], dailyGoalMin: 180, activeProjectsCount: 1, now: NOW });
    expect(done.risk).toBe('done');
  });
  it('slipped tasks make a project at risk', () => {
    const y = addDays(NOW, -1).toISOString();
    const st = projectStats({ project: project({ dueDate: dayKey(addDays(NOW, 30)) }), tasks: [task({ scheduledFor: y })], sessions: [session(100, 1)], dailyGoalMin: 180, activeProjectsCount: 1, now: NOW });
    expect(st.risk).toBe('at_risk');
    expect(st.reasons[0]).toMatch(/1 task slipped from Wed/);
  });
});

describe('scheduling', () => {
  const settings = { dailyGoalMin: 60 };
  it('packs tasks from 09:00 with 5-minute gaps, respecting capacity and deadlines', () => {
    const p = project({ dueDate: dayKey(addDays(NOW, 1)) });
    const morning = new Date(2026, 9, 22, 7, 0);
    const ts = [task({ estimateMin: 15 }), task({ estimateMin: 15 }), task({ estimateMin: 15 }), task({ estimateMin: 15 }), task({ estimateMin: 15 })];
    const res = schedule(ts, settings, ts, [p], morning);
    const when = res.placements.map((x) => new Date(x.to!));
    expect(when[0].getHours()).toBe(9);
    expect(when[0].getMinutes()).toBe(0);
    expect(when[1].getMinutes()).toBe(20);
    expect(dayKey(when[3])).toBe(dayKey(NOW)); // 4 × 15 = 60 fits today
    expect(dayKey(when[4])).toBe(dayKey(addDays(NOW, 1))); // overflow → tomorrow (the due day)
    expect(res.unplaced).toHaveLength(0);
  });
  it('never places after the due date and reports unplaced', () => {
    const p = project({ dueDate: dayKey(NOW) });
    const ts = Array.from({ length: 6 }, () => task({ estimateMin: 15 }));
    const res = schedule(ts, settings, ts, [p], new Date(2026, 9, 22, 8, 0));
    expect(res.placements).toHaveLength(4);
    expect(res.unplaced).toHaveLength(2);
  });
  it('prioritizes task deadlines and does not schedule after one', () => {
    const p = project({ dueDate: dayKey(addDays(NOW, 5)) });
    const urgent = task({ dueDate: dayKey(NOW), estimateMin: 15 });
    const later = task({ estimateMin: 15 });
    const placed = schedule([later, urgent], { dailyGoalMin: 15 }, [later, urgent], [p], new Date(2026, 9, 22, 8));
    expect(placed.placements[0].taskId).toBe(urgent.id);
    expect(dayKey(new Date(placed.placements[0].to!))).toBe(urgent.dueDate);
    const overdue = task({ dueDate: dayKey(addDays(NOW, -1)) });
    expect(schedule([overdue], settings, [overdue], [p], NOW).unplaced).toContain(overdue.id);
  });
  it('starts no earlier than now on today', () => {
    const ts = [task()];
    const res = schedule(ts, settings, ts, [project()], new Date(2026, 9, 22, 13, 2));
    expect(new Date(res.placements[0].to!).getHours()).toBe(13);
    expect(new Date(res.placements[0].to!).getMinutes()).toBe(5);
  });
  it('orders by due date then priority', () => {
    const a = project({ id: 'a', dueDate: dayKey(addDays(NOW, 5)), priority: 'high' });
    const b = project({ id: 'b', dueDate: dayKey(addDays(NOW, 2)), priority: 'low' });
    const ts = [task({ projectId: 'a' }), task({ projectId: 'b' })];
    const res = schedule(ts, settings, ts, [a, b], new Date(2026, 9, 22, 7));
    expect(res.placements[0].taskId).toBe(ts[1].id);
  });
  it('replan previews slipped tasks, apply and undo restore', () => {
    const p = project({ dueDate: dayKey(addDays(NOW, 5)) });
    const yesterday = new Date(2026, 9, 21, 9, 0).toISOString();
    const slipped = task({ scheduledFor: yesterday });
    const other = task({ status: 'done', scheduledFor: yesterday });
    const preview = replan({ tasks: [slipped, other], projects: [p], settings }, NOW);
    expect(preview).toHaveLength(1);
    expect(preview[0].from).toBe(yesterday);
    const { tasks, undo } = applyPlacements([slipped, other], preview, true);
    const moved = tasks.find((t) => t.id === slipped.id)!;
    expect(moved.replannedFrom).toBe(yesterday);
    expect(new Date(moved.scheduledFor!).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
    const back = revertPlacements(tasks, undo).find((t) => t.id === slipped.id)!;
    expect(back.scheduledFor).toBe(yesterday);
    expect(back.replannedFrom).toBeUndefined();
  });
  it('nightly auto-replan timing', () => {
    expect(lastNightlyRun(NOW).getDate()).toBe(21);
    expect(autoReplanDue(new Date(2026, 9, 21, 21, 0).toISOString(), NOW)).toBe(true);
    expect(autoReplanDue(new Date(2026, 9, 21, 22, 30).toISOString(), NOW)).toBe(false);
    expect(autoReplanDue(undefined, NOW)).toBe(true);
  });
});

describe('focus timer', () => {
  it('derives remaining from wall clock and survives pause/resume', () => {
    let t = T.newTimer(15);
    t = T.start(t, 0);
    expect(T.remainingMs(t, 60_000)).toBe(14 * 60_000);
    t = T.pause(t, 60_000);
    expect(T.remainingMs(t, 10 * 60_000)).toBe(14 * 60_000); // paused, time passes
    t = T.start(t, 10 * 60_000);
    expect(T.remainingMs(t, 11 * 60_000)).toBe(13 * 60_000);
    expect(T.elapsedMs(t, 11 * 60_000)).toBe(2 * 60_000);
  });
  it('+5 min extends while running and when paused', () => {
    let t = T.start(T.newTimer(10), 0);
    t = T.extend(t, 60_000);
    expect(T.remainingMs(t, 60_000)).toBe(14 * 60_000);
    expect(t.lengthMs).toBe(15 * 60_000);
    t = T.extend(T.pause(t, 60_000), 60_000);
    expect(T.remainingMs(t, 999_999)).toBe(19 * 60_000);
  });
  it('detects finish and formats the clock', () => {
    const t = T.start(T.newTimer(10), 0);
    expect(T.isFinished(t, 10 * 60_000)).toBe(true);
    expect(T.clock(14 * 60_000 + 59_001)).toBe('15:00');
    expect(T.clock(61_000)).toBe('01:01');
  });
});

describe('analytics', () => {
  it('heatmap quartiles', () => {
    const lv = heatLevels([0, 1, 2, 3, 4, 8]);
    expect(lv[0]).toBe(0);
    expect(lv[5]).toBe(4);
    expect([...lv].sort((a, b) => a - b)).toEqual(lv); // monotonic in the count
    expect(lv.every((l) => l >= 0 && l <= 4)).toBe(true);
    expect(heatLevels([0, 0])).toEqual([0, 0]);
  });
  it('streak ends today or yesterday', () => {
    const done = (daysAgo: number) => task({ status: 'done', completedAt: addDays(NOW, -daysAgo).toISOString() });
    expect(streak([done(0), done(1), done(2), done(4)], NOW)).toBe(3);
    expect(streak([done(1), done(2)], NOW)).toBe(2);
    expect(streak([done(2)], NOW)).toBe(0);
  });
  it('on-time rate counts settled deadlines in range', () => {
    const ok = project({ id: 'a', dueDate: dayKey(addDays(NOW, -3)), completedAt: addDays(NOW, -4).toISOString() });
    const missed = project({ id: 'b', dueDate: dayKey(addDays(NOW, -1)) });
    const future = project({ id: 'c', dueDate: dayKey(addDays(NOW, 3)) });
    const tasks = new Map([['b', [task({ projectId: 'b' })]]]);
    const r = onTimeRate([ok, missed, future], tasks, addDays(NOW, -7), addDays(NOW, 7), NOW);
    expect(r).toMatchObject({ total: 2, onTime: 1, missed: 1, rate: 0.5 });
  });
  it('KPIs change with the range', () => {
    const data = { tasks: [task({ status: 'done', completedAt: addDays(NOW, -2).toISOString() }), task({ status: 'done', completedAt: addDays(NOW, -20).toISOString() })], sessions: [session(30, 1), session(60, 15)], projects: [] };
    const a = rangeKpis(data, 7, NOW);
    const b = rangeKpis(data, 30, NOW);
    expect(a.tasksCompleted).toBe(1);
    expect(b.tasksCompleted).toBe(2);
    expect(a.focusMin).toBe(30);
    expect(b.focusMin).toBe(90);
    expect(a.focusPerDay).toHaveLength(7);
    expect(b.focusPerDay).toHaveLength(30);
  });
});

describe('alerts', () => {
  it('thresholds', () => {
    expect(alertKind(project({ dueDate: dayKey(addDays(NOW, 2)) }), NOW)).toBe('3d');
    expect(alertKind(project({ dueDate: dayKey(NOW) }), new Date(2026, 9, 22, 22, 30))).toBe('2h');
    expect(alertKind(project({ dueDate: dayKey(NOW) }), NOW)).toBe('1d');
    expect(alertKind(project({ dueDate: dayKey(addDays(NOW, -1)) }), NOW)).toBe('overdue');
    expect(alertKind(project({ dueDate: dayKey(addDays(NOW, 10)) }), NOW)).toBeNull();
  });
  it('does not repeat shown alerts', () => {
    const p = project({ dueDate: dayKey(addDays(NOW, -1)) });
    expect(pendingAlerts([p], [task()], [], NOW)).toHaveLength(1);
    expect(pendingAlerts([p], [task()], ['p1:overdue'], NOW)).toHaveLength(0);
  });
});

describe('auth helpers', () => {
  it('password strength score', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh')).toBe(2);
    expect(passwordScore('Abcdefg1')).toBe(3);
    expect(passwordScore('Abcdefg1!')).toBe(4);
  });
});

describe('seed data', () => {
  const seed = buildSeed('u', NOW);
  const active = seed.projects.filter((p) => !p.completedAt);
  const stats = (name: string) => {
    const p = seed.projects.find((x) => x.name === name)!;
    return projectStats({ project: p, tasks: seed.tasks.filter((t) => t.projectId === p.id), sessions: seed.sessions, dailyGoalMin: 180, activeProjectsCount: active.length, now: NOW });
  };
  it('matches the design’s project picture', () => {
    expect(active.map((p) => p.name)).toEqual(['Scholarship essay', 'Obby Lesson Pack', 'Thesis · Chapter 3', 'Q4 Launch Site', 'Portfolio redesign']);
    expect(stats('Scholarship essay')).toMatchObject({ pct: 62, risk: 'overdue' });
    expect(stats('Obby Lesson Pack')).toMatchObject({ pct: 72, risk: 'on_track' });
    expect(stats('Thesis · Chapter 3').risk).toBe('at_risk');
    expect(stats('Q4 Launch Site')).toMatchObject({ pct: 58, risk: 'at_risk' });
    expect(stats('Portfolio redesign')).toMatchObject({ pct: 15, risk: 'on_track' });
  });
  it('has today’s plan, focus history and a streak', () => {
    const today = seed.tasks.filter((t) => t.scheduledFor && dayKey(new Date(t.scheduledFor)) === dayKey(NOW));
    expect(today).toHaveLength(7);
    const todayFocus = seed.sessions.filter((s) => dayKey(new Date(s.startedAt)) === dayKey(NOW)).reduce((a, s) => a + s.minutes, 0);
    expect(todayFocus).toBe(95);
    expect(streak(seed.tasks, NOW)).toBeGreaterThanOrEqual(10);
    const days = new Set(seed.sessions.map((s) => dayKey(new Date(s.startedAt))));
    expect(days.size).toBeGreaterThan(25);
  });
  it('every seeded task is valid', () => {
    seed.tasks.forEach((t) => {
      expect(t.estimateMin).toBeGreaterThanOrEqual(5);
      expect(t.estimateMin).toBeLessThanOrEqual(30);
      if (t.status === 'done') expect(t.completedAt).toBeTruthy();
    });
  });
});

describe('seed is stable at any time of day', () => {
  for (const [h, m] of [[0, 20], [6, 0], [9, 30], [18, 0], [23, 50]]) {
    it(`at ${h}:${String(m).padStart(2, '0')}`, () => {
      const now = new Date(2026, 9, 22, h, m);
      const seed = buildSeed('u', now);
      const active = seed.projects.filter((p) => !p.completedAt);
      const risk = (name: string) => {
        const p = seed.projects.find((x) => x.name === name)!;
        return projectStats({ project: p, tasks: seed.tasks.filter((t) => t.projectId === p.id), sessions: seed.sessions, dailyGoalMin: 180, activeProjectsCount: active.length, now }).risk;
      };
      expect(risk('Scholarship essay')).toBe('overdue');
      expect(risk('Obby Lesson Pack')).toBe('on_track');
      expect(risk('Thesis · Chapter 3')).toBe('at_risk');
      expect(risk('Q4 Launch Site')).toBe('at_risk');
      expect(risk('Portfolio redesign')).toBe('on_track');
      seed.sessions.forEach((s) => expect(new Date(s.startedAt).getTime()).toBeLessThanOrEqual(now.getTime()));
      seed.tasks.filter((t) => t.completedAt).forEach((t) => expect(new Date(t.completedAt!).getTime()).toBeLessThanOrEqual(now.getTime()));
    });
  }
});
