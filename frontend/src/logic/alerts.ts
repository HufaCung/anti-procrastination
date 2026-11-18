import type { Project, Task } from '../data/types';
import { dueEnd } from './dates';

export type AlertKind = '3d' | '1d' | '2h' | 'overdue';

export interface DeadlineAlert {
  projectId: string;
  kind: AlertKind;
  key: string;
  projectName: string;
  openTasks: number;
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
    const key = `${p.id}:${p.dueDate}:${kind}`;
    if (seen.has(key)) continue;
    out.push({ projectId: p.id, projectName: p.name, openTasks: open, kind, key, tone: kind === 'overdue' || kind === '2h' ? 'danger' : 'warn' });
  }
  return out;
}
