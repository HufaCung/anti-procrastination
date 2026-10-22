import { Router, type Response } from 'express';
import { getAppData, saveAppData } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { AppData } from '../types.js';

export const dataRouter = Router();

dataRouter.use(authMiddleware);

// GET /api/data - Retrieve all user data
dataRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const data = getAppData(user.id);
  res.json({ data });
});

// PUT /api/data - Full sync user data
dataRouter.put('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const data = req.body.data as AppData;

  if (!data) {
    res.status(400).json({ error: 'data payload is required' });
    return;
  }

  saveAppData(user.id, data);
  const updated = getAppData(user.id);
  res.json({ data: updated, success: true });
});
