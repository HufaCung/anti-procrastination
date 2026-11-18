import crypto from 'node:crypto';

// OWASP's 32 MiB scrypt profile; asynchronous work leaves the event loop available.
const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt$32768$8$3$';
const derive = (password: string, salt: Buffer): Promise<Buffer> => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
});
export const isLegacyPasswordHash = (hash: string): boolean => /^[a-f0-9]{64}$/i.test(hash);

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt);
  return `${PREFIX}${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(userId: string, password: string, stored: string): Promise<boolean> {
  if (isLegacyPasswordHash(stored)) {
    const candidate = crypto.createHash('sha256').update(`nt:${userId}:${password}`).digest();
    return crypto.timingSafeEqual(candidate, Buffer.from(stored, 'hex'));
  }
  if (!stored.startsWith(PREFIX)) return false;
  const parts = stored.slice(PREFIX.length).split('$');
  if (parts.length !== 2 || !/^[a-f0-9]{32}$/.test(parts[0]) || !/^[a-f0-9]{128}$/.test(parts[1])) return false;
  const key = await derive(password, Buffer.from(parts[0], 'hex'));
  return crypto.timingSafeEqual(key, Buffer.from(parts[1], 'hex'));
}
