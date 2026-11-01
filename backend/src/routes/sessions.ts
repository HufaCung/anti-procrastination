import { isDataValidationError } from '../db/errors.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import { sessionsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { FocusSession } from '../types.js';

export const sessionsRouter = Router();

sessionsRouter.use(authMiddleware);

// GET /api/sessions
sessionsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const sessions = await sessionsDb.getByUser(user.id);
  res.json({ sessions });
}));

// POST /api/sessions
sessionsRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  try { await sessionsDb.save(session); } catch {
    res.status(400).json({ error: 'Invalid session or related resource' });
    return;
  }
  res.status(201).json({ session });
}));
