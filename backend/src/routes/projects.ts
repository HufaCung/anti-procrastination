import { isDataValidationError } from '../db/errors.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import { projectsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { Project } from '../types.js';

export const projectsRouter = Router();

projectsRouter.use(authMiddleware);

// GET /api/projects
projectsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const projects = await projectsDb.getByUser(user.id);
  res.json({ projects });
}));

// POST /api/projects
projectsRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id, name, color, description, priority, dueDate, createdAt, completedAt } = req.body;

  if (!name || !dueDate) {
    res.status(400).json({ error: 'Name and dueDate are required' });
    return;
  }

  const project: Project = {
    id: id || 'p_' + Math.random().toString(36).slice(2, 10),
    userId: user.id,
    name: name.trim(),
    color: color || '#2383E2',
    description: description || undefined,
    priority: priority || 'medium',
    dueDate,
    createdAt: createdAt || new Date().toISOString(),
    completedAt: completedAt || undefined,
  };

  try { await projectsDb.save(project); } catch (error) {
    if (!isDataValidationError(error)) throw error;
    res.status(400).json({ error: 'Invalid project or ownership' });
    return;
  }
  res.status(201).json({ project });
}));

// DELETE /api/projects/:id
projectsRouter.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await projectsDb.delete(id, user.id);
  if (!deleted) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ success: true });
}));
