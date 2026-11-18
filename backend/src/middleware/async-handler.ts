import type { RequestHandler, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';

export function asyncHandler(handler: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };
}
