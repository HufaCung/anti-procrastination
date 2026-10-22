import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, ThemeIconButton, useDocumentTitle } from '../components/ui';
import { useNow, useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import * as T from '../logic/timer';
import { fmtMinutesPadded } from '../logic/dates';

const CIRC = 2 * Math.PI * 130; // 816.8

export function FocusPage() {
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = useNow(250);
  const data = s.data!;
  const timer = data.meta.timer ?? T.newTimer(data.settings.defaultTaskMin === 10 ? 10 : 15);
  const [note, setNote] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Queue = today's scheduled tasks in time order (+ a task picked via ?task= that isn't scheduled today).
  const queue = useMemo(() => {
    const list = [...s.todayTasks];
    const picked = timer.taskId ? data.tasks.find((t) => t.id === timer.taskId) : undefined;
    if (picked && !list.some((t) => t.id === picked.id)) list.unshift(picked);
    return list;
  }, [s.todayTasks, timer.taskId, data.tasks]);

  const projectById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);

  // ?task=:id starts on a specific task; otherwise make sure the timer points at the first open task.
  useEffect(() => {
    const tid = params.get('task');
    if (tid && data.tasks.some((t) => t.id === tid)) {
      if (timer.taskId !== tid && !timer.running) s.timerSelectTask(tid);
      const next = new URLSearchParams(params);
      next.delete('task');
      setParams(next, { replace: true });
      return;
    }
    if (!timer.running && T.isPristine(timer)) {
      const cur = timer.taskId ? data.tasks.find((t) => t.id === timer.taskId) : undefined;
      if (!cur || cur.status === 'done') {
        const first = queue.find((t) => t.status !== 'done');
        if (first && first.id !== timer.taskId) s.timerSelectTask(first.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, queue]);

  const current = timer.taskId ? data.tasks.find((t) => t.id === timer.taskId) : undefined;
  const currentProject = current ? projectById.get(current.projectId) : undefined;
  const position = current ? queue.findIndex((t) => t.id === current.id) + 1 : 0;
  const leftMins = queue.filter((t) => t.status !== 'done').reduce((a, t) => a + t.estimateMin, 0);

  const rem = T.remainingMs(timer, now.getTime());
  const frac = timer.lengthMs ? rem / timer.lengthMs : 0;
  const clock = T.clock(rem);
  const pristine = T.isPristine(timer);
  useDocumentTitle(timer.running ? `${clock} · Focus` : 'Focus Mode');

  const stateLabel = timer.running ? 'Focusing · stay with it' : pristine ? (current ? 'Ready when you are' : 'Free session · no task selected') : 'Paused';

  const toggle = () => (timer.running ? s.timerPause() : s.timerStart());

  // Space toggles the timer (outside inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) {
        e.preventDefault();
        toggleRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lengthMin = timer.lengthMs / 60_000;

  return (
    <div className="focus-page">
      <header className="focus-head">
        <div className="row" style={{ gap: 10 }}>
          <span className={`live-dot ${timer.running ? 'running' : ''}`} aria-hidden="true" />
          <span style={{ fontWeight: 600 }}>Focus Mode</span>
          <span className="muted">· notifications paused</span>
        </div>
        <div className="row wrap" style={{ gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <span data-testid="focus-today">Today {fmtMinutesPadded(s.todayFocusMin)} · {s.todaySessions} {s.todaySessions === 1 ? 'session' : 'sessions'}</span>
          <ThemeIconButton theme={s.theme} onToggle={() => s.setTheme(s.theme === 'dark' ? 'light' : 'dark')} />
          <button type="button" className="btn btn-secondary btn-md" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <Icon name="x" size={14} />
            Exit
          </button>
        </div>
      </header>

      <main id="main" className="focus-body page-enter">
        <section aria-label="Timer" className="timer-col">
          <div className="col" style={{ alignItems: 'center', gap: 8, textAlign: 'center', maxWidth: 560 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {current ? `${currentProject?.name ?? 'Task'}${position > 0 ? ` · task ${position} of ${queue.length}` : ''}` : 'No task selected'}
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
              {current ? current.title : 'Pick a task from the queue, or just focus'}
            </h1>
          </div>

          <div className="ring">
            <svg viewBox="0 0 300 300" width="100%" height="100%" role="img" aria-label={`${Math.floor(rem / 60000)} minutes ${Math.ceil((rem % 60000) / 1000) % 60} seconds remaining`}>
              <circle cx="150" cy="150" r="130" fill="none" stroke="var(--track)" strokeWidth="10" />
              <circle
                className="prog"
                cx="150" cy="150" r="130" fill="none"
                stroke={timer.running ? 'var(--accent-hover)' : 'var(--accent)'}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={CIRC.toFixed(1)}
                strokeDashoffset={(CIRC * (1 - frac)).toFixed(1)}
                style={!timer.running ? { transition: 'stroke-dashoffset 300ms ease, stroke 300ms ease' } : undefined}
              />
            </svg>
            <div className="center">
              <span className="clock" data-testid="clock" aria-hidden="true">{clock}</span>
              <span className="sr-only" aria-live="polite">{timer.running ? '' : stateLabel}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{stateLabel}</span>
            </div>
          </div>

          <div role="radiogroup" aria-label="Session length" className="seg tall" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 6 }}>
            {T.PRESETS_MIN.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={lengthMin === p} disabled={timer.running} onClick={() => s.timerSetLength(p)}>
                {p} min
              </button>
            ))}
          </div>

          <div className="row wrap" style={{ gap: 10, justifyContent: 'center' }}>
            <button type="button" className="icon-btn round-btn" aria-label="Reset timer" title="Reset" onClick={s.timerReset} disabled={pristine}>
              <Icon name="reset" size={18} />
            </button>
            <button ref={toggleRef} type="button" className="btn btn-dark pill-btn" style={{ minWidth: 148, fontSize: 15, fontWeight: 650 }} onClick={toggle}>
              <Icon name={timer.running ? 'pause' : 'play'} size={15} />
              {timer.running ? 'Pause' : pristine ? 'Start' : 'Resume'}
            </button>
            <button type="button" className="btn btn-secondary pill-btn" onClick={s.timerExtend}>+5 min</button>
            <button type="button" className="btn btn-ok pill-btn" onClick={() => s.timerComplete(false)} disabled={!current && pristine}>
              <Icon name="check" size={15} stroke={2.4} />
              {current ? 'Mark done' : 'Log session'}
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Press Space to start or pause</span>
        </section>

        <aside className="col" style={{ flex: '1 1 300px', minWidth: 0, maxWidth: 380, gap: 14 }}>
          <section aria-labelledby="q-h" className="card clip">
            <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
              <h2 id="q-h" style={{ fontSize: 14, fontWeight: 600 }}>Up next</h2>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{leftMins} min left</span>
            </div>
            {queue.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing scheduled today" body="Plan your day on the dashboard, or start a free session.">
                <Link to="/" className="btn btn-secondary btn-sm">Go to dashboard</Link>
              </EmptyState>
            ) : (
              <ul className="task-list" style={{ padding: '6px 0' }}>
                {queue.map((t) => {
                  const cur = t.id === current?.id && t.status !== 'done';
                  const done = t.status === 'done';
                  return (
                    <li key={t.id} className={`queue-row ${cur ? 'current' : ''}`} aria-current={cur ? 'true' : undefined}>
                      <span className="dot round" style={{ background: done ? 'var(--ok-strong)' : cur ? 'var(--accent)' : 'var(--control)' }} aria-hidden="true" />
                      <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        {done || cur ? (
                          <span className={`t ${done ? 'done' : ''}`}>{t.title}</span>
                        ) : (
                          <button
                            type="button"
                            className="t"
                            title="Focus on this task"
                            onClick={() => {
                              if (timer.running) {
                                toast({ title: 'Pause or finish the current session first' });
                                return;
                              }
                              s.timerSelectTask(t.id);
                            }}
                          >
                            {t.title}
                          </button>
                        )}
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{projectById.get(t.projectId)?.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.estimateMin}m</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card col" style={{ padding: '14px 16px', gap: 8 }}>
            <label htmlFor="parking" style={{ fontSize: 13, fontWeight: 600 }}>Parking lot</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                s.addParking(note);
                setNote('');
              }}
              className="row"
            >
              <input id="parking" className="input" style={{ height: 38, background: 'var(--subtle)', fontSize: 13 }} placeholder="Jot a distraction, deal with it later" value={note} onChange={(e) => setNote(e.target.value)} />
            </form>
            {data.meta.parking.length > 0 && (
              <ul className="parking-list">
                {data.meta.parking.map((n) => (
                  <li key={n.id}>
                    <Icon name="note" size={13} style={{ color: 'var(--faint)', flex: 'none' }} />
                    <span>{n.text}</span>
                    <button type="button" className="icon-btn plain sm" aria-label={`Remove note: ${n.text}`} onClick={() => s.removeParking(n.id)}>
                      <Icon name="x" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
