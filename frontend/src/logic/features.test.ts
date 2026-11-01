import { describe, expect, it } from 'vitest';
import type { Project, Task } from '../data/types';
import { schedule } from './schedule';
import { pendingAlerts } from './alerts';
import { progressOf } from './progress';

const now = new Date(2026, 10, 1, 8);
const project: Project = { id: 'p', userId: 'u', name: 'Report', color: '#000', priority: 'high', dueDate: '2026-11-02', createdAt: now.toISOString() };
const task = (id: string, patch: Partial<Task> = {}): Task => ({ id, userId: 'u', projectId: 'p', title: id, section: 'Inbox', status: 'todo', estimateMin: 15, order: 0, createdAt: now.toISOString(), ...patch });
const slot = (hour: number, minute = 0) => new Date(2026, 10, 1, hour, minute).toISOString();

describe('feature regressions', () => {
  it('fills the morning gap before a later appointment without moving existing work', () => {
    const later = task('later', { scheduledFor: slot(16), estimateMin: 60 });
    const result = schedule([task('new')], { dailyGoalMin: 120 }, [later], [project], now);
    expect(result.placements[0].to).toBe(slot(9));
    expect(later.scheduledFor).toBe(slot(16));
  });
  it('leaves five-minute buffers on both sides of a slot', () => {
    const existing = [task('a', { scheduledFor: slot(9), estimateMin: 30 }), task('b', { scheduledFor: slot(10), estimateMin: 30 })];
    const result = schedule([task('fits', { estimateMin: 20 }), task('after', { estimateMin: 25, order: 1 })], { dailyGoalMin: 180 }, existing, [project], now);
    expect(result.placements.map(p => p.to)).toEqual([slot(9, 35), slot(10, 35)]);
  });
  it('keeps daily capacity and deadlines when a day is full', () => {
    const result = schedule([task('new')], { dailyGoalMin: 60 }, [task('full', { scheduledFor: slot(16), estimateMin: 60 })], [{ ...project, dueDate: '2026-11-01' }], now);
    expect(result.placements).toHaveLength(0);
    expect(result.unplaced).toEqual(['new']);
  });
  it('never places a slot before now or beyond 22:00', () => {
    const late = new Date(2026, 10, 1, 21, 55);
    const result = schedule([task('new')], { dailyGoalMin: 120 }, [], [project], late);
    expect(result.placements[0].to).toBe(new Date(2026, 10, 2, 9).toISOString());
  });
  it('does not repeat an alert until the project deadline changes', () => {
    const p = { ...project, dueDate: '2026-11-03' };
    const first = pendingAlerts([p], [task('a')], [], now);
    expect(first).toHaveLength(1);
    const seen = first.map(a => a.key);
    expect(pendingAlerts([p], [task('a')], seen, now)).toHaveLength(0);
    expect(pendingAlerts([{ ...p, dueDate: '2026-11-02' }], [task('a')], seen, now)).toHaveLength(1);
  });
  it('keeps alerts after the first batch pending', () => {
    const projects = Array.from({ length: 5 }, (_, i) => ({ ...project, id: `p${i}` }));
    const pending = pendingAlerts(projects, [], [], now);
    const seen = pending.slice(0, 3).map(a => a.key);
    expect(pendingAlerts(projects, [], seen, now).map(a => a.projectId)).toEqual(['p3', 'p4']);
  });
  it('counts completed tasks separately from remaining estimated minutes', () => {
    expect(progressOf([task('small', { status: 'done', estimateMin: 5 }), task('large', { estimateMin: 60 })])).toEqual({ total: 2, done: 1, pct: 50, remainingMin: 60 });
  });
});
