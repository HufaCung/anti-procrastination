import type { Task, TaskStatus } from '../data/types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

/** todo → in_progress → done → todo */
export function nextStatus(s: TaskStatus): TaskStatus {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

/** Returns a copy of the task with the new status, keeping completedAt consistent. */
export function withStatus(task: Task, status: TaskStatus, now: Date): Task {
  if (task.status === status) return task;
  const next: Task = { ...task, status };
  if (status === 'done') next.completedAt = now.toISOString();
  else delete next.completedAt;
  return next;
}

export function cycleTask(task: Task, now: Date): Task {
  return withStatus(task, nextStatus(task.status), now);
}

/** Checkbox: done ↔ todo. */
export function toggleDone(task: Task, now: Date): Task {
  return withStatus(task, task.status === 'done' ? 'todo' : 'done', now);
}

/** Starting a focus session moves a not-done task to in_progress. */
export function startTask(task: Task, now: Date): Task {
  return task.status === 'todo' ? withStatus(task, 'in_progress', now) : task;
}
