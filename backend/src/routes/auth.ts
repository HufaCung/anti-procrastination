import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { usersDb } from '../db/database.js';
import { signToken, authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { User, SafeUser } from '../types.js';

export const authRouter = Router();

export function sanitizeUser(user: User): SafeUser;
export function sanitizeUser(user: null): null;
export function sanitizeUser(user: User | null): SafeUser | null;
export function sanitizeUser(user: User | null): SafeUser | null {
  if (!user) return null;
  const { passwordHash: _discard, ...safeUser } = user;
  return safeUser;
}

function hashPassword(userId: string, password: string): string {
  return crypto.createHash('sha256').update(`nt:${userId}:${password}`).digest('hex');
}

// POST /api/auth/signup
authRouter.post('/signup', (req, res: Response) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 100 || /\s/.test(username.trim())) {
    res.status(400).json({ error: 'Username must be 2-100 characters without spaces' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
    res.status(400).json({ error: 'Password must be 8-1024 characters' });
    return;
  }
  const normalized = username.trim().toLowerCase();
  if (usersDb.findByUsername(normalized)) {
    res.status(409).json({ error: 'An account with this username already exists' });
    return;
  }

  const userId = crypto.randomUUID();
  const newUser: User = {
    id: userId,
    name: username.trim(),
    username: normalized,
    passwordHash: hashPassword(userId, password),
    createdAt: new Date().toISOString(),
  };

  try {
    usersDb.create(newUser);
    res.status(201).json({ token: signToken(newUser.id), user: sanitizeUser(newUser) });
  } catch {
    res.status(409).json({ error: 'Account already exists' });
  }
});

// POST /api/auth/login
authRouter.post('/login', (req, res: Response) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  const user = usersDb.findByUsername(username);
  if (!user) {
    res.status(200).json({ error: 'Username or password is incorrect' });
    return;
  }

  if (typeof password !== 'string' || hashPassword(user.id, password) !== user.passwordHash) {
    res.status(200).json({ error: 'Username or password is incorrect' });
    return;
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: sanitizeUser(user),
  });
});

// GET /api/auth/me
authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user!) });
});

// PATCH /api/auth/profile
authRouter.patch('/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { name, username, avatar } = req.body;

  const patch: Partial<User> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (username !== undefined) {
    res.status(400).json({ error: 'Username cannot be changed' });
    return;
  }
  if (avatar !== undefined) patch.avatar = avatar;

  const updated = usersDb.update(user.id, patch);
  res.json({ user: sanitizeUser(updated) });
});

// POST /api/auth/change-password
authRouter.post('/change-password', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { oldPassword, oldPasswordHash, newPassword, newPasswordHash } = req.body;

  let matches = false;
  if (oldPasswordHash && oldPasswordHash === user.passwordHash) {
    matches = true;
  } else if (oldPassword) {
    matches = hashPassword(user.id, oldPassword) === user.passwordHash;
  }

  if (!matches) {
    res.status(400).json({ error: 'Current password does not match' });
    return;
  }

  const finalNewHash = newPasswordHash || (newPassword ? hashPassword(user.id, newPassword) : null);
  if (!finalNewHash) {
    res.status(400).json({ error: 'New password is required' });
    return;
  }

  const updated = usersDb.update(user.id, {
    passwordHash: finalNewHash,
    passwordChangedAt: new Date().toISOString(),
  });

  res.json({ user: sanitizeUser(updated) });
});

authRouter.post('/forgot-password', (_req, res: Response) => {
  res.status(503).json({ error: 'Password reset is not available yet' });
});
