import { Router, type Response } from 'express';
import { projectsDb } from '../db/database.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { Project } from '../types.js';

export const projectsRouter = Router();

projectsRouter.use(authMiddleware);

// GET /api/projects
projectsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const projects = projectsDb.getByUser(user.id);
  res.json({ projects });
});

// POST /api/projects
projectsRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
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

  projectsDb.save(project);
  res.status(201).json({ project });
});

// DELETE /api/projects/:id
projectsRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = projectsDb.delete(id, user.id);
  if (!deleted) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ success: true });
});
