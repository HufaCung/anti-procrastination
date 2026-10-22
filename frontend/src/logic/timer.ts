import type { ActiveTimer } from '../data/types';

export const PRESETS_MIN = [10, 15, 25] as const;
export const EXTEND_MS = 5 * 60_000;

export function newTimer(lengthMin: number, taskId?: string): ActiveTimer {
  const lengthMs = lengthMin * 60_000;
  return { taskId, lengthMs, remainingMs: lengthMs, running: false };
}

/** Remaining time is derived from wall-clock time, never from interval ticks. */
export function remainingMs(t: ActiveTimer, now: number): number {
  if (t.running && t.endsAt != null) return Math.max(0, t.endsAt - now);
  return Math.max(0, t.remainingMs);
}

export function elapsedMs(t: ActiveTimer, now: number): number {
  return Math.max(0, t.lengthMs - remainingMs(t, now));
}

export function start(t: ActiveTimer, now: number): ActiveTimer {
  if (t.running) return t;
  const rem = t.remainingMs > 0 ? t.remainingMs : t.lengthMs;
  return { ...t, running: true, endsAt: now + rem, remainingMs: rem, firstStartedAt: t.firstStartedAt ?? new Date(now).toISOString() };
}

export function pause(t: ActiveTimer, now: number): ActiveTimer {
  if (!t.running) return t;
  return { ...t, running: false, remainingMs: remainingMs(t, now), endsAt: undefined };
}

export function reset(t: ActiveTimer): ActiveTimer {
  return { ...t, running: false, endsAt: undefined, remainingMs: t.lengthMs, firstStartedAt: undefined };
}

export function extend(t: ActiveTimer, now: number, ms = EXTEND_MS): ActiveTimer {
  if (t.running && t.endsAt != null) {
    // Base on the derived remaining time so an already-expired timer restarts cleanly.
    const rem = remainingMs(t, now);
    return { ...t, lengthMs: t.lengthMs + ms, endsAt: now + rem + ms, remainingMs: rem + ms };
  }
  return { ...t, lengthMs: t.lengthMs + ms, remainingMs: t.remainingMs + ms };
}

export function setLength(t: ActiveTimer, lengthMin: number): ActiveTimer {
  return newTimer(lengthMin, t.taskId);
}

export function isFinished(t: ActiveTimer, now: number): boolean {
  return t.running && remainingMs(t, now) <= 0;
}

export function isPristine(t: ActiveTimer): boolean {
  return !t.running && t.remainingMs === t.lengthMs;
}

/** mm:ss */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
