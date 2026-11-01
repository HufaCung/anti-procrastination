import crypto from 'node:crypto';

export function hashPassword(userId: string, password: string): string {
  return crypto.createHash('sha256').update(`nt:${userId}:${password}`).digest('hex');
}
