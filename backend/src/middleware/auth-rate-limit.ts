import type { RequestHandler } from 'express';

const WINDOW_MS = 60_000;
const MAX_CLIENTS = 10_000;

/** Per-process, fixed-window limit with a bounded store and no background timers. */
export function authRateLimit(maxAttempts: number): RequestHandler {
  const counts = new Map<string, number>();
  let resetAt = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= resetAt) {
      counts.clear();
      resetAt = now + WINDOW_MS;
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const count = counts.get(ip) ?? 0;
    if (count >= maxAttempts || (count === 0 && counts.size >= MAX_CLIENTS)) {
      res.set('Retry-After', String(Math.ceil((resetAt - now) / 1000)));
      res.status(429).json({ error: 'Too many authentication attempts. Try again shortly.' });
      return;
    }

    counts.set(ip, count + 1);
    next();
  };
}
