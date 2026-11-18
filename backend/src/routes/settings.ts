import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import { isDataValidationError } from '../db/errors.js';
import { settingsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { Settings } from '../types.js';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

// GET /api/settings
settingsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const settings = await settingsDb.get(user.id);
  res.json({ settings });
}));

// PATCH /api/settings
settingsRouter.patch('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const current = await settingsDb.get(user.id);
  const updated: Settings = {
    ...current,
    ...req.body,
    userId: user.id,
  };

  try {
    await settingsDb.save(updated);
  } catch (error) {
    if (!isDataValidationError(error)) throw error;
    res.status(400).json({ error: 'Invalid working hours or days off' });
    return;
  }
  res.json({ settings: updated });
}));
