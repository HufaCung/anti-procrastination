import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { usersDb, deleteUserData } from '../db/database.js';
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

function generateUserId(): string {
  return 'u_' + Math.random().toString(36).slice(2, 10);
}

// POST /api/auth/signup
authRouter.post('/signup', (req, res: Response) => {
  const { name, email, password, passwordHash, id } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const existing = usersDb.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const userId = id || generateUserId();
  const finalHash = passwordHash || (password ? hashPassword(userId, password) : null);

  if (!finalHash) {
    res.status(400).json({ error: 'Password or passwordHash is required' });
    return;
  }

  const newUser: User = {
    id: userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: finalHash,
    createdAt: new Date().toISOString(),
  };

  usersDb.create(newUser);
  const token = signToken(newUser.id);

  res.status(201).json({
    token,
    user: sanitizeUser(newUser),
  });
});

// POST /api/auth/login
authRouter.post('/login', (req, res: Response) => {
  const { email, password, passwordHash } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const user = usersDb.findByEmail(email);
  if (!user) {
    res.status(200).json({ error: 'Email or password is incorrect' });
    return;
  }

  const expectedHash = user.passwordHash;
  let matches = false;

  if (passwordHash && passwordHash === expectedHash) {
    matches = true;
  } else if (password) {
    const computed = hashPassword(user.id, password);
    matches = computed === expectedHash;
  }

  if (!matches) {
    res.status(200).json({ error: 'Email or password is incorrect' });
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
  const { name, avatar } = req.body;

  const patch: Partial<User> = {};
  if (name !== undefined) patch.name = String(name).trim();
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

// POST /api/auth/forgot-password (mock/direct reset)
authRouter.post('/forgot-password', (req, res: Response) => {
  const { email, newPassword, newPasswordHash } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const user = usersDb.findByEmail(email);
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
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

// DELETE /api/auth/account
authRouter.delete('/account', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  deleteUserData(user.id);
  res.json({ success: true, message: 'Account and all data deleted' });
});
