import type { CSSProperties } from 'react';

const PATHS: Record<string, string[]> = {
  dashboard: [],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  calendar: ['M16 3v4M8 3v4M3 10h18'],
  focus: ['M12 9v4l2.5 2.5M9 2h6'],
  chart: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  search: ['m20 20-3.5-3.5'],
  plus: ['M12 5v14M5 12h14'],
  sun: ['M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  chevrons: ['m7 15 5 5 5-5', 'm7 9 5-5 5 5'],
  sparkles: ['M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4M12 17h.01'],
  check: ['M5 12.5 10 17 19 7'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  reset: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
  clock: ['M12 7v5l3 2'],
  trash: ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'],
  x: ['M18 6 6 18M6 6l12 12'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5M11 18l-6-6 6-6'],
  up: ['m18 15-6-6-6 6'],
  down: ['m6 9 6 6 6-6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1', 'M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  lock: ['M8 11V7a4 4 0 0 1 8 0v4'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z'],
  flag: ['M4 22V4', 'M4 4h13l-2 4 2 4H4'],
  target: [],
  upload: ['M12 21V9', 'm7 14 5-5 5 5', 'M5 3h14'],
  note: ['M14 3v5h5', 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'],
};

export type IconName = keyof typeof PATHS | 'play' | 'pause' | 'priority';

export function Icon({ name, size = 16, stroke = 2, style, className }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: 'false' as const, style, className,
  };
  if (name === 'play') return <svg {...common} fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>;
  if (name === 'pause') return <svg {...common} fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>;
  if (name === 'priority') return <svg {...common} fill="currentColor"><rect x="3" y="14" width="4" height="7" rx="1" /><rect x="10" y="9" width="4" height="12" rx="1" /><rect x="17" y="4" width="4" height="17" rx="1" /></svg>;
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {name === 'dashboard' && (
        <>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </>
      )}
      {name === 'calendar' && <rect x="3" y="5" width="18" height="16" rx="2" />}
      {name === 'focus' && <circle cx="12" cy="13" r="8" />}
      {name === 'search' && <circle cx="11" cy="11" r="7" />}
      {name === 'sun' && <circle cx="12" cy="12" r="4" />}
      {name === 'clock' && <circle cx="12" cy="12" r="9" />}
      {name === 'eye' && <circle cx="12" cy="12" r="3" />}
      {name === 'lock' && <rect x="4" y="11" width="16" height="10" rx="2" />}
      {name === 'target' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </>
      )}
      {(PATHS[name] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
