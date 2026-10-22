import { Router, type Response } from 'express';
import { settingsDb, defaultSettings } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { Settings } from '../types.js';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

// GET /api/settings
settingsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const settings = settingsDb.get(user.id);
  res.json({ settings });
});

// PATCH /api/settings
settingsRouter.patch('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const current = settingsDb.get(user.id);
  const updated: Settings = {
    ...current,
    ...req.body,
    userId: user.id,
  };

  settingsDb.save(updated);
  res.json({ settings: updated });
});
