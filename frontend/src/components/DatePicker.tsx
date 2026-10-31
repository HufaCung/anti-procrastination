import { useEffect, useId, useRef, useState } from 'react';
import { addDays, dayKey, fmt, parseDay } from '../logic/dates';
import { Icon } from './Icon';

export function DatePicker({ id, label, value, onChange, min, error, optional = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  min?: string; error?: string; optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDay(value || dayKey(new Date())));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const today = dayKey(new Date());

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -(first.getDay() + 6) % 7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const select = (day: string) => {
    onChange(day);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="field date-field" ref={root} data-calendar-open={open ? 'true' : undefined} onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
      <label htmlFor={id}>{label}</label>
      <button id={id} ref={trigger} type="button" className={`date-trigger ${error ? 'err' : ''}`} aria-expanded={open} aria-controls={panelId} aria-invalid={!!error} onClick={() => {
        if (!open) setMonth(parseDay(value || today));
        setOpen(!open);
      }}>
        <span className="date-trigger-icon"><Icon name="calendar" size={17} /></span>
        <span className={value ? '' : 'date-placeholder'}>{value ? `${fmt.monthDay(parseDay(value))}, ${parseDay(value).getFullYear()}` : 'Choose a date'}</span>
        <span className="date-trigger-arrow" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {error && <span role="alert" className="err-text">{error}</span>}
      {open && <div id={panelId} className="date-calendar" role="group" aria-label={`${label} calendar`}>
        <div className="date-calendar-head">
          <div><span className="date-calendar-eyebrow">PICK A DATE</span><div className="date-calendar-month" aria-live="polite">{fmt.monthYear(month)}</div></div>
          <div className="date-calendar-nav">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
          </div>
        </div>
        <div className="date-calendar-grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="date-weekday" aria-hidden="true">{d}</span>)}
          {days.map((day) => {
            const key = dayKey(day);
            return <button key={key} type="button" className={`date-day ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === value ? 'selected' : ''} ${key === today ? 'today' : ''}`} aria-label={`${fmt.longDate(day)}, ${day.getFullYear()}`} aria-pressed={key === value} disabled={!!min && key < min} onClick={() => select(key)}>{day.getDate()}</button>;
          })}
        </div>
        <div className="date-calendar-footer">
          <button type="button" onClick={() => select(today)} disabled={!!min && today < min}>Today</button>
          {optional && value && <button type="button" onClick={() => select('')}>Clear date</button>}
        </div>
      </div>}
    </div>
  );
}
