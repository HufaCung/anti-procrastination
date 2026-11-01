import crypto from 'node:crypto';
import { db, usersDb, metaDb, defaultMeta } from '../db/database.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import type { User } from '../types.js';

export async function createAdmin(username: string, password: string): Promise<{ created: boolean; userId: string }> {
  if (!/^\S{2,100}$/.test(username) || password.length < 8 || password.length > 1024) {
    throw new Error('Supply a username of 2–100 characters and a password of 8–1024 characters.');
  }
  const existing = usersDb.findByUsername(username);
  if (existing) {
    if (existing.role !== 'admin') throw new Error('Username already belongs to a regular user. No account was promoted or changed.');
    if (!await verifyPassword(existing.id, password, existing.passwordHash)) throw new Error('Admin already exists with a different password. No password was changed.');
    return { created: false, userId: existing.id };
  }
  const passwordHash = await hashPassword(password);
  return db.transaction(() => {
    const user: User = { id: crypto.randomUUID(), name: 'Administrator', username: username.toLowerCase(), role: 'admin', passwordHash, createdAt: new Date().toISOString() };
    usersDb.create(user);
    metaDb.save({ ...defaultMeta(user.id), onboarded: true });
    return { created: true, userId: user.id };
  })();
}
