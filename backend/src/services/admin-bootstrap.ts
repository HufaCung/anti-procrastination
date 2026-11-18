import { usersDb } from '../db/database.js';
import { createAdmin } from './admin-account.js';

/** Server-owned configuration only; never reachable through a public API. */
export async function bootstrapAdmin(environment: NodeJS.ProcessEnv = process.env): Promise<'disabled' | 'created' | 'existing'> {
  if (environment.BOOTSTRAP_ADMIN !== 'true') return 'disabled';
  const username = environment.ADMIN_USERNAME || 'admin';
  if (!/^\S{2,100}$/.test(username)) throw new Error('Invalid ADMIN_USERNAME for admin bootstrap.');
  const existing = await usersDb.findByUsername(username);
  if (existing) {
    if (existing.role !== 'admin') throw new Error('Admin bootstrap username belongs to a regular user. Choose a different ADMIN_USERNAME.');
    // A later password change must survive restarts even if the bootstrap secret is stale.
    return 'existing';
  }
  const password = environment.ADMIN_PASSWORD;
  if (!password || password.length < 8 || password.length > 1024) throw new Error('Admin bootstrap requires ADMIN_PASSWORD of 8–1024 characters.');
  const result = await createAdmin(username, password);
  return result.created ? 'created' : 'existing';
}
