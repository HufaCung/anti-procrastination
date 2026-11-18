import { isDataValidationError } from '../db/errors.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import { getAppDataSnapshot, syncAppData } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { AppData } from '../types.js';

export const dataRouter = Router();

dataRouter.use(authMiddleware);

// GET /api/data - Retrieve all user data
dataRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  res.json(await getAppDataSnapshot(user.id));
}));

// PUT /api/data - Full sync user data
dataRouter.put('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const data = req.body.data as AppData;

  if (!data || !Array.isArray(data.projects) || !Array.isArray(data.tasks) || !Array.isArray(data.sessions) || !Number.isSafeInteger(req.body.revision) || req.body.revision < 0) {
    res.status(400).json({ error: 'data and revision are required' });
    return;
  }

  try {
    const revision = await syncAppData(user.id, data, req.body.revision);
    if (revision === null) {
      res.status(409).json({ error: 'Data changed on another device' });
      return;
    }
    res.json({ success: true, revision });
  } catch (error) {
    if (!isDataValidationError(error)) throw error;
    res.status(400).json({ error: 'Invalid data or record ownership' });
  }
}));
