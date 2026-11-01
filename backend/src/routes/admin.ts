import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import { getAdminUsers } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';

export const adminRouter = Router();
// The development x-user-id shortcut must never grant administrative access.
adminRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Bearer authentication required' });
    return;
  }
  next();
});
adminRouter.use(authMiddleware);
adminRouter.use((req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
});

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const rawPage = req.query.page ?? '1';
  const rawSearch = req.query.q ?? '';
  if (typeof rawPage !== 'string' || !/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage)) || Number(rawPage) > 1_000_000 || typeof rawSearch !== 'string' || rawSearch.length > 100) {
    res.status(400).json({ error: 'Invalid page or search query' });
    return;
  }
  const page = Number(rawPage);
  const search = rawSearch.trim();
  const pageSize = 25;
  // Explicit projections keep credentials, avatars, notes and free-text workspace content out of this API.
  const result = await getAdminUsers(page, search, pageSize);
  res.json(result);
}));
