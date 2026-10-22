import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { addDays, dayKey, daysBetween, fmt, parseDay, startOfDay, startOfWeek } from '../logic/dates';
import { RISK_LABEL } from '../logic/progress';
import type { Project, Task } from '../data/types';

type Chip = { kind: 'deadline' | 'overdue' | 'done' | 'task'; label: string };
type AgendaItem = { time: string; title: string; meta: string; color: string; sort: string; href: string };

function shortName(name: string) {
  const head = name.split('·')[0].trim();
  return head.split(' ')[0];
}

export function CalendarPage() {
  useDocumentTitle('Calendar');
  const s = useStore();
  const toast = useToast();
  const data = s.data!;
  const now = s.now;
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [sel, setSel] = useState(() => dayKey(now));
  const weekStart = data.settings.weekStart;

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    data.tasks.forEach((t) => {
      if (!t.scheduledFor) return;
      const k = dayKey(new Date(t.scheduledFor));
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!)));
    return m;
  }, [data.tasks]);

  const deadlines = useMemo(() => {
    const m = new Map<string, Project[]>();
    data.projects.forEach((p) => {
      const arr = m.get(p.dueDate) ?? [];
      arr.push(p);
      m.set(p.dueDate, arr);
    });
    return m;
  }, [data.projects]);

  const projectById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);
  const todayKey = dayKey(now);

  const chipsFor = (key: string): Chip[] => {
    const out: Chip[] = [];
    (deadlines.get(key) ?? []).forEach((p) => {
      const risk = s.stats.get(p.id)?.risk;
      out.push({ kind: risk === 'overdue' ? 'overdue' : 'deadline', label: risk === 'overdue' ? `${p.name} due` : p.name });
    });
    const tasks = byDay.get(key) ?? [];
    const groups = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const arr = groups.get(t.projectId) ?? [];
      arr.push(t);
      groups.set(t.projectId, arr);
    });
    const past = key < todayKey;
    const doneChips: Chip[] = [];
    groups.forEach((ts, pid) => {
      const name = shortName(projectById.get(pid)?.name ?? 'Task');
      const open = ts.filter((t) => t.status !== 'done');
      const done = ts.length - open.length;
      if (open.length) {
        const replanned = open.filter((t) => t.replannedFrom).length;
        const label = past
          ? `${name}: ${open.length} left over`
          : open.length === 1
            ? `${name}: ${open[0].title}`
            : `${name}: ${open.length} ${replanned === open.length ? 'replanned' : 'tasks'}`;
        out.push({ kind: 'task', label });
      }
      if (done) doneChips.push({ kind: 'done', label: `${name}: ${done} done` });
    });
    return [...out, ...doneChips];
  };

  // Month grid.
  const gridStart = startOfWeek(month, weekStart);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const totalDays = daysBetween(gridStart, monthEnd) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const dows = Array.from({ length: 7 }, (_, i) => fmt.dow(addDays(gridStart, i)));

  // Agenda for the selected day.
  const selDate = parseDay(sel);
  const agenda: AgendaItem[] = [];
  (deadlines.get(sel) ?? []).forEach((p) => {
    const st = s.stats.get(p.id);
    const left = st ? st.total - st.done : 0;
    agenda.push({
      time: '23:59', sort: '23:59z', title: `${p.name} due`, href: `/projects/${p.id}`,
      meta: st?.risk === 'overdue' ? `Missed · ${left} ${left === 1 ? 'task' : 'tasks'} still open` : st?.risk === 'done' ? 'Finished' : `${st?.pct ?? 0}% · ${RISK_LABEL[st?.risk ?? 'on_track'].toLowerCase()}`,
      color: st?.risk === 'overdue' ? 'var(--danger-text)' : 'var(--inverse)',
    });
  });
  (byDay.get(sel) ?? []).forEach((t) => {
    const p = projectById.get(t.projectId);
    const d = new Date(t.scheduledFor!);
    const state = t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'in progress' : t.replannedFrom ? 'replanned' : sel < todayKey ? 'missed' : '';
    agenda.push({
      time: fmt.time(d), sort: fmt.time(d), title: t.title, href: `/projects/${t.projectId}?task=${t.id}`,
      meta: [p?.name, `${t.estimateMin} min`, state].filter(Boolean).join(' · '),
      color: t.status === 'done' ? 'var(--ok-strong)' : t.status === 'in_progress' ? 'var(--accent)' : t.replannedFrom ? (p?.color ?? 'var(--accent)') : sel < todayKey ? 'var(--danger-text)' : 'var(--control)',
    });
  });
  agenda.sort((a, b) => a.sort.localeCompare(b.sort));

  const upcoming = s.activeProjects.filter((p) => p.dueDate >= todayKey).slice(0, 3);
  const isToday = sel === todayKey;
  const isPastSel = sel < todayKey;

  const shiftMonth = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => {
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSel(todayKey);
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = addDays(parseDay(sel), map[e.key]);
    const k = dayKey(next);
    setSel(k);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    window.setTimeout(() => document.getElementById(`cell-${k}`)?.focus(), 0);
  };

  return (
    <Page label="Calendar">
      <header className="row wrap" style={{ gap: 12, justifyContent: 'space-between' }}>
        <div className="row wrap" style={{ gap: 12 }}>
          <h1 className="page-title" aria-live="polite" style={{ minWidth: 190 }}>{fmt.monthYear(month)}</h1>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}><Icon name="left" size={16} /></button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shiftMonth(1)}><Icon name="right" size={16} /></button>
          </div>
          <button type="button" className="btn btn-secondary btn-md" onClick={goToday}>Today</button>
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: 'var(--inverse)' }} />Deadline</span>
          <span><i style={{ background: 'var(--accent-soft)', boxShadow: 'inset 0 0 0 1px var(--h2)' }} />Scheduled tasks</span>
          <span><i style={{ background: 'var(--pill)' }} />Done</span>
          <span><i style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-text)' }} />Overdue</span>
        </div>
      </header>

      <div className="split">
        <section aria-label="Month" className="card clip main cal-wrap">
          <div className="cal" key={dayKey(month)}>
            <div className="cal-dows">
              {dows.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="cal-grid page-enter" role="group" aria-label={`Days in ${fmt.monthYear(month)}. Use arrow keys to move between days.`} onKeyDown={onGridKey}>
              {cells.map((d, i) => {
                const k = dayKey(d);
                const inMonth = d.getMonth() === month.getMonth();
                const chips = chipsFor(k);
                const shown = chips.slice(0, 3);
                const dow = d.getDay();
                const weekend = dow === 0 || dow === 6;
                const isSel = k === sel;
                return (
                  <button
                    key={k}
                    id={`cell-${k}`}
                    type="button"
                    aria-pressed={isSel}
                    tabIndex={isSel ? 0 : -1}
                    aria-label={`${fmt.longDate(d)}${chips.length ? `, ${chips.map((c) => c.label).join(', ')}` : ', nothing scheduled'}`}
                    className={`cal-cell ${inMonth ? (weekend ? 'weekend' : '') : 'out'} ${isSel ? 'sel' : ''} ${i >= cells.length - 7 ? 'last-row' : ''}`}
                    onClick={() => {
                      setSel(k);
                      if (!inMonth) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }}
                  >
                    <span className={`cal-num ${k === todayKey ? 'today' : ''}`}>{d.getDate()}</span>
                    {shown.map((c, j) => <span key={j} className={`ev ${c.kind}`}>{c.label}</span>)}
                    {chips.length > 3 && <span className="ev more">+{chips.length - 3} more</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="aside" aria-labelledby="day-h">
          <section className="card clip">
            <div className="card-head" style={{ alignItems: 'baseline' }}>
              <h2 id="day-h" className="section-title">{isToday ? 'Today · ' : ''}{fmt.dowLong(selDate)}, {fmt.monthDay(selDate)}</h2>
              {agenda.length > 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{agenda.length} {agenda.length === 1 ? 'item' : 'items'}</span>}
            </div>
            {agenda.length > 0 ? (
              <ul className="agenda" key={sel}>
                {agenda.map((a, i) => (
                  <li key={i} style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
                    <span className="time">{a.time}</span>
                    <span className="stripe" style={{ background: a.color }} />
                    <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Link to={a.href} style={{ fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}>{a.title}</Link>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.meta}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="col" style={{ padding: '20px 16px', color: 'var(--muted)', gap: 10, alignItems: 'flex-start' }} key={sel}>
                <span>{isPastSel ? 'Nothing was scheduled on this day.' : 'Nothing scheduled. A good day to get ahead.'}</span>
                {!isPastSel && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    onClick={() => {
                      const n = s.pullIntoDay(selDate);
                      toast({
                        tone: n ? 'ok' : 'info',
                        title: n ? `Pulled ${n} ${n === 1 ? 'task' : 'tasks'} into ${fmt.dowMonthDay(selDate)}` : 'No at-risk work to pull in',
                        body: n ? 'From projects that are at risk or overdue.' : 'All projects are on track.',
                        action: n ? { label: 'Undo', onClick: () => s.undoReplan() } : undefined,
                      });
                    }}
                  >
                    Pull tasks from at-risk projects
                  </button>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="next-h" className="card col" style={{ padding: '14px 16px', gap: 12 }}>
            <h2 id="next-h" className="section-title">Next deadlines</h2>
            {upcoming.length === 0 && <span className="muted">No upcoming deadlines.</span>}
            {upcoming.map((p) => {
              const st = s.stats.get(p.id)!;
              const d = parseDay(p.dueDate);
              const days = daysBetween(startOfDay(now), d);
              const risky = st.risk === 'at_risk';
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="row" style={{ gap: 12, color: 'var(--text)', textDecoration: 'none' }}>
                  <div className="date-tile"><span className="m">{fmt.monthShort(d).toUpperCase()}</span><span className="d">{d.getDate()}</span></div>
                  <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: risky ? 'var(--warn-text)' : 'var(--muted)', fontWeight: risky ? 500 : 400 }}>
                      {days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`} · {st.pct}% · {RISK_LABEL[st.risk].toLowerCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        </aside>
      </div>
    </Page>
  );
}
