/** Date helpers. Everything works in the browser's local time. */

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

/** Local YYYY-MM-DD key. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local date at 00:00. */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Due date (YYYY-MM-DD) → end of that day, local. */
export function dueEnd(dueDate: string): Date {
  return endOfDay(parseDay(dueDate));
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Whole calendar days from a to b (b - a), ignoring time of day. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

export function startOfWeek(d: Date, weekStart: 'mon' | 'sun'): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sun
  const offset = weekStart === 'mon' ? (dow + 6) % 7 : dow;
  return addDays(x, -offset);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const fmt = {
  monthDay: (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`,
  monthShort: (d: Date) => MONTHS[d.getMonth()],
  monthLong: (d: Date) => MONTHS_LONG[d.getMonth()],
  monthYear: (d: Date) => `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`,
  dow: (d: Date) => DOW[d.getDay()],
  dowLong: (d: Date) => DOW_LONG[d.getDay()],
  dowMonthDay: (d: Date) => `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`,
  longDate: (d: Date) => `${DOW_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`,
  time: (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
};

/** "1h 35m", "45m", "2h", "0m" */
export function fmtMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

/** "1h 05m" style with zero-padded minutes (used for logged focus). */
export function fmtMinutesPadded(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return `${h}h ${String(r).padStart(2, '0')}m`;
}

/** Relative label for a due date: "Today", "Tomorrow", "In 5 days", "1 day ago". */
export function relDue(dueDate: string, now: Date): string {
  const n = daysBetween(now, parseDay(dueDate));
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `In ${n} days`;
  if (n === -1) return 'Yesterday';
  return `${-n} days ago`;
}

/** Relative label for a scheduled date: Today / Tomorrow / weekday / Oct 30. */
export function relDay(d: Date, now: Date): string {
  const n = daysBetween(now, d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return fmt.dow(d);
  return fmt.monthDay(d);
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Slot label: "Today 14:00", "Tomorrow 09:00", "Wed, Oct 28 · 09:00". */
export function fmtSlot(d: Date, now: Date, withTime = true): string {
  const n = daysBetween(now, d);
  const day = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : fmt.dowMonthDay(d);
  if (!withTime) return day;
  return n >= -1 && n <= 1 ? `${day} ${fmt.time(d)}` : `${day} · ${fmt.time(d)}`;
}
