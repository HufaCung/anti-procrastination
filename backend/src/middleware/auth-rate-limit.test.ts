import { afterEach, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { authRateLimit } from './auth-rate-limit.js';

afterEach(() => vi.restoreAllMocks());

it('limits each client independently and allows requests after the window resets', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const limit = authRateLimit(2);
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), set: vi.fn(), json: vi.fn() };
  const send = (ip: string) => limit({ ip } as Request, res as unknown as Response, next);

  send('192.0.2.1');
  send('192.0.2.1');
  send('192.0.2.1');
  expect(next).toHaveBeenCalledTimes(2);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.set).toHaveBeenCalledWith('Retry-After', '60');

  send('192.0.2.2');
  expect(next).toHaveBeenCalledTimes(3);
  now.mockReturnValue(61_000);
  send('192.0.2.1');
  expect(next).toHaveBeenCalledTimes(4);
});
