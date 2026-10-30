import { Router, type Response } from 'express';
import { getAppData, getDataRevision, syncAppData } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { AppData } from '../types.js';

export const dataRouter = Router();

dataRouter.use(authMiddleware);

// GET /api/data - Retrieve all user data
dataRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const data = getAppData(user.id);
  res.json({ data, revision: getDataRevision(user.id) });
});

// PUT /api/data - Full sync user data
dataRouter.put('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const data = req.body.data as AppData;

  if (!data || !Array.isArray(data.projects) || !Array.isArray(data.tasks) || !Array.isArray(data.sessions) || !Number.isSafeInteger(req.body.revision) || req.body.revision < 0) {
    res.status(400).json({ error: 'data and revision are required' });
    return;
  }

  try {
    const revision = syncAppData(user.id, data, req.body.revision);
    if (revision === null) {
      res.status(409).json({ error: 'Data changed on another device' });
      return;
    }
    res.json({ success: true, revision });
  } catch {
    res.status(400).json({ error: 'Invalid data or record ownership' });
  }
});
