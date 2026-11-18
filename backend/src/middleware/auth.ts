import { asyncHandler } from './async-handler.js';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { usersDb } from '../db/database.js';
import type { User } from '../types.js';

const devSecretFallback = crypto.randomBytes(32).toString('hex');

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
  return devSecretFallback;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function signToken(userId: string, authVersion = 0): string {
  return jwt.sign({ userId, authVersion }, getJwtSecret(), { expiresIn: '30d', algorithm: 'HS256' });
}

export const authMiddleware = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const devUserId = req.headers['x-user-id'] as string | undefined;

  let userId: string | null = null;
  let tokenVersion: number | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || typeof decoded.userId !== 'string' || (decoded.authVersion !== undefined && (!Number.isSafeInteger(decoded.authVersion) || decoded.authVersion < 0))) throw new Error('Invalid token claims');
      userId = decoded.userId;
      tokenVersion = decoded.authVersion ?? 0;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } else if (process.env.NODE_ENV !== 'production' && devUserId) {
    userId = devUserId;
  }

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await usersDb.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (tokenVersion !== null && tokenVersion !== (user.authVersion ?? 0)) {
    res.status(401).json({ error: 'Session revoked. Sign in again.' });
    return;
  }

  req.user = user;
  next();
});
