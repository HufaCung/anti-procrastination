import { Router, type Response } from 'express';
import { db } from '../db/database.js';
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

adminRouter.get('/users', (req, res) => {
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
  const result = db.transaction(() => {
    const filter = 'instr(lower(u.username), lower(@search)) > 0 OR instr(lower(u.name), lower(@search)) > 0';
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM users u WHERE ${filter}`).get({ search }) as { total: number };
    const users = db.prepare(`SELECT u.id, u.name, u.username, u.role, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
      (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id) AS tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.status = 'done') AS completedTasks,
      (SELECT COUNT(*) FROM focus_sessions s WHERE s.user_id = u.id) AS sessions,
      (SELECT COALESCE(SUM(minutes), 0) FROM focus_sessions s WHERE s.user_id = u.id) AS focusMinutes
      FROM users u WHERE ${filter}
      ORDER BY u.created_at DESC, u.id ASC LIMIT @limit OFFSET @offset`).all({ search, limit: pageSize, offset: (page - 1) * pageSize });
    const summary = db.prepare(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM projects) AS projects,
      (SELECT COUNT(*) FROM tasks) AS tasks,
      (SELECT COUNT(*) FROM focus_sessions) AS sessions,
      (SELECT COALESCE(SUM(minutes), 0) FROM focus_sessions) AS focusMinutes`).get();
    return { users, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), summary };
  })();
  res.json(result);
});
