let counter = 0;

export function uid(prefix = ''): string {
  counter = (counter + 1) % 1_000_000;
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return prefix + c.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + counter.toString(36);
}
