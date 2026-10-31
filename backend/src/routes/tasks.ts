import { Router, type Response } from 'express';
import { tasksDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { Task } from '../types.js';

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

// GET /api/tasks
tasksRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tasks = tasksDb.getByUser(user.id);
  res.json({ tasks });
});

// POST /api/tasks
tasksRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id, projectId, section, title, estimateMin, status, order, scheduledFor, completedAt, createdAt, replannedFrom, subtasks, dueDate } = req.body;

  if (!projectId || !title) {
    res.status(400).json({ error: 'projectId and title are required' });
    return;
  }

  const task: Task = {
    id: id || 't_' + Math.random().toString(36).slice(2, 10),
    userId: user.id,
    projectId,
    section: section || 'Inbox',
    title: title.trim(),
    estimateMin: Number(estimateMin) || 15,
    status: status || 'todo',
    order: Number(order) || 0,
    scheduledFor: scheduledFor || undefined,
    dueDate: dueDate || undefined,
    completedAt: completedAt || undefined,
    createdAt: createdAt || new Date().toISOString(),
    replannedFrom: replannedFrom || undefined,
    subtasks,
  };

  try {
    tasksDb.save(task);
  } catch {
    res.status(400).json({ error: 'Invalid task or project' });
    return;
  }
  res.status(201).json({ task });
});

// DELETE /api/tasks/:id
tasksRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = tasksDb.delete(id, user.id);
  if (!deleted) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ success: true });
});
