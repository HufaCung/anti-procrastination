import { Router, type Response } from 'express';
import { sessionsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { FocusSession } from '../types.js';

export const sessionsRouter = Router();

sessionsRouter.use(authMiddleware);

// GET /api/sessions
sessionsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const sessions = sessionsDb.getByUser(user.id);
  res.json({ sessions });
});

// POST /api/sessions
sessionsRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id, taskId, projectId, startedAt, endedAt, minutes, completedTask } = req.body;

  if (!startedAt || !endedAt) {
    res.status(400).json({ error: 'startedAt and endedAt are required' });
    return;
  }

  const session: FocusSession = {
    id: id || 'fs_' + Math.random().toString(36).slice(2, 10),
    userId: user.id,
    taskId: taskId || undefined,
    projectId: projectId || undefined,
    startedAt,
    endedAt,
    minutes: Number(minutes) || 0,
    completedTask: Boolean(completedTask),
  };

  sessionsDb.save(session);
  res.status(201).json({ session });
});
