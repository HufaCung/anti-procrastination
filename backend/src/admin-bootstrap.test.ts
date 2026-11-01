import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { bootstrapAdmin } from './services/admin-bootstrap.js';
import { usersDb, metaDb } from './db/database.js';
import { hashPassword, verifyPassword } from './security/password.js';

describe('server-configured admin bootstrap', () => {
  it('is disabled by default even if credentials are present', async () => {
    const username = `disabled-${crypto.randomUUID()}`;
    expect(await bootstrapAdmin({ ADMIN_USERNAME: username, ADMIN_PASSWORD: crypto.randomUUID() })).toBe('disabled');
    expect(usersDb.findByUsername(username)).toBeNull();
  });
  it('creates once with a server-hashed password, skips onboarding and preserves subsequent password changes', async () => {
    const username = `bootstrap-${crypto.randomUUID()}`;
    const password = crypto.randomUUID();
    const environment = { BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: username, ADMIN_PASSWORD: password };
    expect(await bootstrapAdmin(environment)).toBe('created');
    const original = usersDb.findByUsername(username)!;
    expect(original.role).toBe('admin');
    expect(original.passwordHash).not.toBe(password);
    expect(await verifyPassword(original.id, password, original.passwordHash)).toBe(true);
    expect(metaDb.get(original.id).onboarded).toBe(true);
    expect(await bootstrapAdmin({ ...environment, ADMIN_PASSWORD: 'different-secret' })).toBe('existing');
    expect(usersDb.findByUsername(username)).toEqual(original);
    expect(await bootstrapAdmin({ ...environment, ADMIN_PASSWORD: undefined })).toBe('existing');
    const updatedPassword = crypto.randomUUID();
    const changed = usersDb.changePassword(original.id, original.passwordHash, await hashPassword(updatedPassword))!;
    expect(await bootstrapAdmin(environment)).toBe('existing');
    expect(usersDb.findById(original.id)).toEqual(changed);
    expect(await verifyPassword(original.id, updatedPassword, changed.passwordHash)).toBe(true);

  });
  it('never promotes an existing regular user', async () => {
    const id = crypto.randomUUID();
    const username = `normal-${id}`;
    usersDb.create({ id, username, name: 'Regular', passwordHash: 'unchanged', createdAt: new Date().toISOString() });
    await expect(bootstrapAdmin({ BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: username, ADMIN_PASSWORD: crypto.randomUUID() })).rejects.toThrow(/regular user/);
    expect(usersDb.findById(id)?.role).toBe('user');
    expect(usersDb.findById(id)?.passwordHash).toBe('unchanged');
  });
  it('rejects missing or invalid credentials without creating an account', async () => {
    for (const password of [undefined, '', 'short', 'x'.repeat(1025)]) {
      const username = `invalid-${crypto.randomUUID()}`;
      await expect(bootstrapAdmin({ BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: username, ADMIN_PASSWORD: password })).rejects.toThrow(/ADMIN_PASSWORD/);
      expect(usersDb.findByUsername(username)).toBeNull();
    }
    await expect(bootstrapAdmin({ BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: 'invalid username', ADMIN_PASSWORD: crypto.randomUUID() })).rejects.toThrow(/ADMIN_USERNAME/);
  });
});
