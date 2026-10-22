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

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: '30d' });
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const devUserId = req.headers['x-user-id'] as string | undefined;

  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
      userId = decoded.userId;
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

  const user = usersDb.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.user = user;
  next();
}
