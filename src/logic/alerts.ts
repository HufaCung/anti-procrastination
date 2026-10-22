import type { Project, Task } from '../data/types';
import { dueEnd } from './dates';

export type AlertKind = '3d' | '1d' | '2h' | 'overdue';

export interface DeadlineAlert {
  projectId: string;
  kind: AlertKind;
  key: string;
  title: string;
  body: string;
  tone: 'warn' | 'danger';
}

const H = 3_600_000;

/** Most urgent threshold crossed for a project, if any. */
export function alertKind(project: Project, now: Date): AlertKind | null {
  const ms = dueEnd(project.dueDate).getTime() - now.getTime();
  if (ms < 0) return 'overdue';
  if (ms <= 2 * H) return '2h';
  if (ms <= 24 * H) return '1d';
  if (ms <= 72 * H) return '3d';
  return null;
}

/** Alerts that have not been shown yet. Projects with no open tasks are skipped. */
export function pendingAlerts(projects: Project[], tasks: Task[], shown: string[], now: Date): DeadlineAlert[] {
  const seen = new Set(shown);
  const out: DeadlineAlert[] = [];
  for (const p of projects) {
    if (p.completedAt) continue;
    const own = tasks.filter((t) => t.projectId === p.id);
    const open = own.filter((t) => t.status !== 'done').length;
    if (own.length > 0 && open === 0) continue;
    const kind = alertKind(p, now);
    if (!kind) continue;
    const key = `${p.id}:${kind}`;
    if (seen.has(key)) continue;
    const left = `${open} ${open === 1 ? 'task' : 'tasks'} left`;
    const text: Record<AlertKind, [string, string]> = {
      '3d': [`${p.name} is due in 3 days`, `${left}. Plan a few sessions now to stay ahead.`],
      '1d': [`${p.name} is due tomorrow`, `${left}. Today is the last full day to finish.`],
      '2h': [`${p.name} is due in 2 hours`, `${left}. Wrap up the essentials.`],
      overdue: [`${p.name} is overdue`, `${left}. Replan them into today’s free slots.`],
    };
    out.push({ projectId: p.id, kind, key, title: text[kind][0], body: text[kind][1], tone: kind === 'overdue' || kind === '2h' ? 'danger' : 'warn' });
  }
  return out;
}
