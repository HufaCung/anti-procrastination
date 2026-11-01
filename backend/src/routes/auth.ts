import { isDataValidationError } from '../db/errors.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { usersDb } from '../db/database.js';
import { signToken, authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import type { User, SafeUser } from '../types.js';
import { hashPassword, verifyPassword, isLegacyPasswordHash } from '../security/password.js';

export const authRouter = Router();

export function sanitizeUser(user: User): SafeUser;
export function sanitizeUser(user: null): null;
export function sanitizeUser(user: User | null): SafeUser | null;
export function sanitizeUser(user: User | null): SafeUser | null {
  if (!user) return null;
  const { passwordHash: _discard, authVersion: _version, ...safeUser } = user;
  return safeUser;
}

// POST /api/auth/signup
authRouter.post('/signup', asyncHandler(async (req, res: Response, next) => {
  try {
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
    if (await usersDb.findByUsername(normalized)) {
      res.status(409).json({ error: 'An account with this username already exists' });
      return;
    }

    const userId = crypto.randomUUID();
    const newUser: User = {
      id: userId,
      name: username.trim(),
      username: normalized,
      role: 'user',
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    try {
      await usersDb.create(newUser);
      res.status(201).json({ token: signToken(newUser.id), user: sanitizeUser(newUser) });
    } catch (error) {
      if (!isDataValidationError(error)) throw error;
      res.status(409).json({ error: 'Account already exists' });
    }
  } catch (error) { next(error); }
}));

// POST /api/auth/login
authRouter.post('/login', asyncHandler(async (req, res: Response, next) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    let user = await usersDb.findByUsername(username);
    if (!user) {
      res.status(200).json({ error: 'Username or password is incorrect' });
      return;
    }

    if (typeof password !== 'string' || password.length > 1024 || !await verifyPassword(user.id, password, user.passwordHash)) {
      res.status(200).json({ error: 'Username or password is incorrect' });
      return;
    }

    const verifiedHash = user.passwordHash;
    if (isLegacyPasswordHash(verifiedHash)) {
      const id = user.id;
      user = await usersDb.upgradePasswordHash(id, verifiedHash, await hashPassword(password));
      if (!user) {
        const current = await usersDb.findById(id);
        if (current && await verifyPassword(id, password, current.passwordHash)) user = current;
      }
    } else {
      user = await usersDb.findById(user.id);
      if (user?.passwordHash !== verifiedHash) user = null;
    }
    if (!user) {
      res.status(200).json({ error: 'Username or password is incorrect' });
      return;
    }
    const token = signToken(user.id, user.authVersion ?? 0);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) { next(error); }
}));

// GET /api/auth/me
authRouter.get('/me', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user!) });
}));

// PATCH /api/auth/profile
authRouter.patch('/profile', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { name, username, avatar } = req.body;

  const patch: Partial<User> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (username !== undefined) {
    res.status(400).json({ error: 'Username cannot be changed' });
    return;
  }
  if (avatar !== undefined) patch.avatar = avatar;

  const updated = await usersDb.update(user.id, patch);
  res.json({ user: sanitizeUser(updated) });
}));

// POST /api/auth/change-password
authRouter.post('/change-password', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user!;
    if ('oldPasswordHash' in req.body || 'newPasswordHash' in req.body) {
      res.status(400).json({ error: 'Password hashes are not accepted' });
      return;
    }
    const { oldPassword, newPassword } = req.body;
    if (typeof oldPassword !== 'string' || oldPassword.length > 1024 || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024) {
      res.status(400).json({ error: 'Current password and a new password of 8–1024 characters are required' });
      return;
    }
    if (!await verifyPassword(user.id, oldPassword, user.passwordHash)) {
      res.status(400).json({ error: 'Current password does not match' });
      return;
    }
    const updated = await usersDb.changePassword(user.id, user.passwordHash, await hashPassword(newPassword));
    if (!updated) {
      res.status(409).json({ error: 'Password changed concurrently. Sign in again.' });
      return;
    }
    // All previously issued tokens are revoked; only this replacement token stays valid.
    res.json({ token: signToken(updated.id, updated.authVersion ?? 0), user: sanitizeUser(updated) });
  } catch (error) { next(error); }
}));

authRouter.post('/forgot-password', asyncHandler(async (_req, res: Response) => {
  res.status(503).json({ error: 'Password reset is not available yet' });
}));
