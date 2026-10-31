import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Page, useUI } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { DatePicker } from '../components/DatePicker';
import { EmptyState, ProgressBar, RiskPill, StatusButton, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import type { Subtask, Task } from '../data/types';
import { uid } from '../logic/ids';
import { daysBetween, fmt, fmtMinutes, fmtMinutesPadded, parseDay, startOfDay } from '../logic/dates';
import { PRIORITY_LABEL } from '../logic/progress';
import * as T from '../logic/timer';

const PRIORITY_COLOR = { high: '#E0560A', medium: '#E0A100', low: '#8A8A86' } as const;

export function ProjectPage() {
  const { id = '' } = useParams();
  const s = useStore();
  const project = s.projectById(id);
  useDocumentTitle(project?.name ?? 'Project');
  if (!project) {
    return (
      <Page label="Project not found">
        <nav aria-label="Breadcrumb" className="breadcrumb"><Link to="/projects">Projects</Link></nav>
        <section className="card">
          <EmptyState icon="folder" title="Project not found" body="It may have been deleted.">
            <Link to="/projects" className="btn btn-secondary">Back to projects</Link>
          </EmptyState>
        </section>
      </Page>
    );
  }
  return <ProjectView key={project.id} projectId={project.id} />;
}

function ProjectView({ projectId }: { projectId: string }) {
  const s = useStore();
  const ui = useUI();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = s.projectById(projectId)!;
  const st = s.stats.get(projectId)!;
  const tasks = s.tasksOf(projectId);
  const now = s.now;
  const settings = s.data!.settings;

  const [draft, setDraft] = useState('');
  const [draftEst, setDraftEst] = useState<number>(settings.defaultTaskMin);
  const [draftErr, setDraftErr] = useState(false);
  const [draftDue, setDraftDue] = useState('');
  const [highlight, setHighlight] = useState<string | null>(params.get('task'));
  const draftRef = useRef<HTMLInputElement>(null);

  // Scroll a task from search into view and flash it.
  useEffect(() => {
    const tid = params.get('task');
    if (!tid) return;
    setHighlight(tid);
    const t = window.setTimeout(() => {
      document.getElementById(`task-${tid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    const t2 = window.setTimeout(() => setHighlight(null), 2200);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [params]);

  const groups = useMemo(() => {
    const names: string[] = [];
    tasks.forEach((t) => {
      if (!names.includes(t.section)) names.push(t.section);
    });
    return names.map((name) => {
      const ts = tasks.filter((t) => t.section === name);
      return { name, tasks: ts, done: ts.filter((t) => t.status === 'done').length };
    });
  }, [tasks]);

  const daysToDue = daysBetween(now, parseDay(project.dueDate));
  const dueLabel = daysToDue > 0 ? `${daysToDue} ${daysToDue === 1 ? 'day' : 'days'}` : daysToDue === 0 ? 'today' : `${-daysToDue} ${daysToDue === -1 ? 'day' : 'days'} ago`;
  const nextTask = [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.status === 'in_progress' ? -1 : 0) - (b.status === 'in_progress' ? -1 : 0) || (a.scheduledFor ?? '9').localeCompare(b.scheduledFor ?? '9') || a.order - b.order)[0];
  const riskColor = st.risk === 'overdue' ? 'var(--danger-text)' : st.risk === 'at_risk' ? 'var(--warn-text)' : undefined;

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) {
      setDraftErr(true);
      draftRef.current?.focus();
      return;
    }
    const t = s.addTask({ projectId, title: draft, estimateMin: draftEst, ...(draftDue ? { dueDate: draftDue } : {}) });
    setDraftDue('');
    setDraft('');
    setDraftErr(false);
    setHighlight(t.id);
    window.setTimeout(() => setHighlight(null), 1200);
  };

  const removeTask = (t: Task) => {
    s.deleteTask(t.id);
    toast({ title: 'Task deleted', body: t.title, action: { label: 'Undo', onClick: () => s.restoreTask(t) } });
  };

  const replan = () => {
    const r = s.replanProject(projectId);
    toast({
      tone: r.unplaced ? 'warn' : 'ok',
      title: r.placed ? `Rescheduled ${r.placed} ${r.placed === 1 ? 'task' : 'tasks'}` : 'Nothing to replan',
      body: r.unplaced ? `${r.unplaced} ${r.unplaced === 1 ? 'task doesn’t' : 'tasks don’t'} fit before the deadline. Raise your daily goal or trim scope.` : r.placed ? 'Unfinished and unscheduled tasks now sit in free slots before the deadline.' : 'Every open task already has a future slot.',
      action: r.placed ? { label: 'Undo', onClick: () => s.undoReplan() } : undefined,
    });
  };

  return (
    <Page label={project.name}>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} aria-current="page">{project.name}</span>
      </nav>

      <header className="row wrap" style={{ gap: 16, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 10, flex: '1 1 420px', minWidth: 0 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="dot lg" style={{ background: project.color }} />
            <h1 className="page-title" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{project.name}</h1>
          </div>
          {project.description && <p style={{ color: 'var(--muted)', lineHeight: 1.5, maxWidth: 720 }}>{project.description}</p>}
          <div className="row wrap">
            <span className="chip">
              <Icon name="calendar" size={14} style={{ color: 'var(--muted)' }} />
              Due {fmt.dowMonthDay(parseDay(project.dueDate))} · {dueLabel}
            </span>
            <span className="chip">
              <Icon name="priority" size={14} style={{ color: PRIORITY_COLOR[project.priority] }} />
              {PRIORITY_LABEL[project.priority]}
            </span>
            <RiskPill risk={st.risk} className="chip-like" />
            <span className="chip" style={{ color: 'var(--text2)' }} data-testid="work-left">{fmtMinutes(st.remainingMin)} of work left</span>
          </div>
        </div>
        <div className="row wrap">
          <button type="button" className="btn btn-secondary" onClick={() => ui.openEditProject(project)}>
            <Icon name="edit" size={15} />
            Edit project
          </button>
          <button type="button" className="btn btn-primary" disabled={!nextTask} onClick={() => nextTask && navigate(`/focus?task=${nextTask.id}`)}>
            <Icon name="play" size={15} />
            Focus on next task
          </button>
        </div>
      </header>

      <section aria-label="Progress" className="card pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, alignItems: 'center' }}>
        <div className="col" style={{ gridColumn: '1 / -1', gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }} data-testid="project-pct">{st.pct}% complete</span>
            <span className="muted tnum">{st.done} of {st.total} tasks</span>
          </div>
          <ProgressBar pct={st.pct} color={project.color} height={8} label={`${project.name} progress`} />
        </div>
        <div className="col stat" style={{ gap: 2 }}><span className="k">Needed per day</span><span className="v">{st.remainingMin ? `${Math.round(st.neededPerDay)} min` : '—'}</span></div>
        <div className="col stat" style={{ gap: 2 }}><span className="k">Your recent pace</span><span className="v">{Math.round(st.pace)} min / day{st.paceIsFallback ? '*' : ''}</span></div>
        <div className="col stat" style={{ gap: 2 }}>
          <span className="k">Projected finish</span>
          <span className="v" style={{ color: st.risk === 'done' ? 'var(--ok-text)' : st.daysLate > 0 ? riskColor ?? 'var(--warn-text)' : undefined }}>
            {st.risk === 'done' ? 'Finished' : st.remainingMin === 0 ? 'Today' : `${fmt.monthDay(st.projectedFinish)}${st.daysLate > 0 ? ` · ${st.daysLate} ${st.daysLate === 1 ? 'day' : 'days'} late` : ''}`}
          </span>
        </div>
        <div className="col stat" style={{ gap: 2 }}><span className="k">Focus logged</span><span className="v">{fmtMinutesPadded(st.focusMin)}</span></div>
        {st.paceIsFallback && st.remainingMin > 0 && (
          <span style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)' }}>* No focus sessions yet, so pace is estimated from your daily goal split across active projects.</span>
        )}
      </section>

      <div className="split">
        <section aria-labelledby="tasks-h" className="card main">
          <div className="card-head" style={{ padding: '12px 16px' }}>
            <h2 id="tasks-h" className="section-title">Task breakdown</h2>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Click a status to move it: To do → In progress → Done</span>
          </div>

          <form onSubmit={addTask} className="col" style={{ padding: '12px 16px', gap: 10 }} noValidate data-tour="add-task">
          <div className="add-form" style={{ padding: 0 }}>
            <label className="grow-input" style={draftErr ? { borderColor: 'var(--danger-text)' } : undefined}>
              <Icon name="plus" size={15} />
              <input ref={draftRef} value={draft} onChange={(e) => { setDraft(e.target.value); setDraftErr(false); }} placeholder="Add a 10–15 min task…" aria-label="New task title" aria-invalid={draftErr} />
            </label>
            <select className="select" value={draftEst} onChange={(e) => setDraftEst(Number(e.target.value))} aria-label="Estimate" data-tour="estimate">
              {[5, 10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
            <button type="submit" className="btn btn-dark">Add</button>
          </div>
          <div style={{ maxWidth: 260 }}><DatePicker id="task-due" label="Task deadline (optional)" value={draftDue} onChange={setDraftDue} optional /></div>
          </form>

          {groups.length === 0 ? (
            <EmptyState icon="inbox" title="No tasks yet" body="Add a 10–15 minute task above. Small steps are easier to start and to schedule." />
          ) : (
            groups.map((g) => (
              <div key={g.name} className="group">
                <div className="group-head">
                  <span className="n">{g.name}</span>
                  <span className="s">{g.done}/{g.tasks.length} done</span>
                </div>
                <ul className="task-list" style={{ padding: '0 0 6px' }}>
                  {g.tasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      first={i === 0}
                      last={i === g.tasks.length - 1}
                      highlight={highlight === t.id}
                      onRename={(title) => s.updateTask(t.id, { title })}
                      onEstimate={(m) => s.updateTask(t.id, { estimateMin: m })}
                      onCycle={() => s.cycleStatus(t.id)}
                      onDelete={() => removeTask(t)}
                      onMove={(dir) => s.moveTask(t.id, dir)}
                      onSubtasks={(fn) => s.updateSubtasks(t.id, fn)}
                      onFocus={() => {
                        const timer = s.data?.meta.timer;
                        if (timer && (timer.running || !T.isPristine(timer))) {
                          toast({ title: 'Finish or reset the current session first' });
                          return;
                        }
                        navigate(`/focus?task=${encodeURIComponent(t.id)}`);
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="aside">
          <section aria-labelledby="risk-h" className="card pad col" style={{ gap: 10 }}>
            {st.risk === 'at_risk' || st.risk === 'overdue' ? (
              <>
                <h2 id="risk-h" className="section-title">{st.risk === 'overdue' ? 'Why it’s overdue' : 'Why it’s at risk'}</h2>
                <ul className="risk-list">
                  {st.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </>
            ) : (
              <>
                <h2 id="risk-h" className="section-title">{st.risk === 'done' ? 'All done' : 'On track'}</h2>
                <p style={{ color: 'var(--text2)', lineHeight: 1.45 }}>
                  {st.risk === 'done'
                    ? 'Every task in this project is finished. Nice work.'
                    : st.total === 0
                      ? 'Add tasks to see whether the deadline is realistic.'
                      : `At ${Math.round(st.pace)} min/day you’ll finish around ${fmt.monthDay(st.projectedFinish)}, before the ${fmt.monthDay(parseDay(project.dueDate))} deadline.`}
                </p>
              </>
            )}
            {st.risk !== 'done' && st.total > 0 && (
              <button type="button" className="btn btn-secondary" style={{ fontWeight: 600 }} onClick={replan}>
                <Icon name="refresh" size={15} />
                Replan unfinished tasks
              </button>
            )}
          </section>
        </aside>
      </div>
    </Page>
  );
}

function TaskRow({
  task, first, last, highlight, onRename, onEstimate, onCycle, onDelete, onMove, onSubtasks, onFocus,
}: {
  task: Task;
  first: boolean;
  last: boolean;
  highlight: boolean;
  onRename: (t: string) => void;
  onEstimate: (m: number) => void;
  onCycle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onSubtasks: (fn: (subtasks: Subtask[]) => Subtask[]) => void;
  onFocus: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [menuAbove, setMenuAbove] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(320);
  const titleRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const cancelTitle = useRef(false);
  const subtasks = task.subtasks ?? [];
  useEffect(() => setTitle(task.title), [task.title]);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const trigger = menuRef.current?.querySelector('button');
      const menu = menuRef.current?.querySelector<HTMLElement>('[role="menu"]');
      if (!trigger || !menu) return;
      const bounds = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - bounds.bottom - 12;
      const spaceAbove = bounds.top - 12;
      const above = spaceBelow < menu.scrollHeight && spaceAbove > spaceBelow;
      setMenuAbove(above);
      setMenuMaxHeight(Math.max(40, Math.min(320, above ? spaceAbove : spaceBelow)));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true); };
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const dismiss = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); } };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', dismiss); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);
  const done = task.status === 'done';
  const dot = done ? 'var(--ok-strong)' : task.status === 'in_progress' ? 'var(--accent)' : 'var(--control)';
  const commit = () => {
    if (cancelTitle.current) { cancelTitle.current = false; setTitle(task.title); return; }
    const v = title.trim();
    if (!v) setTitle(task.title);
    else if (v !== task.title) onRename(v);
  };
  const when = task.scheduledFor ? new Date(task.scheduledFor) : null;
  const slipped = !!when && !done && when.getTime() < startOfDay(new Date()).getTime();
  const estOptions = Array.from(new Set([5, 10, 15, 20, 25, 30, task.estimateMin])).sort((a, b) => a - b);
  return (
    <li id={`task-${task.id}`} className="task-item" style={{ background: highlight ? 'var(--accent-soft)' : undefined, transition: 'background-color 600ms ease' }}>
      <div className="task-row" style={{ padding: '6px 16px' }}>
      <span className="dot round" style={{ background: dot }} aria-hidden="true" />
      <div className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <input
          ref={titleRef}
          className={`inline-edit ${done ? 'done' : ''}`}
          value={title}
          aria-label={`Task title: ${task.title}`}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              cancelTitle.current = true;
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {task.dueDate && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Deadline: {fmt.dowMonthDay(parseDay(task.dueDate))}</span>}
        {when && !done && (
          <span style={{ fontSize: 11.5, color: slipped ? 'var(--danger-text)' : task.replannedFrom ? 'var(--accent-text)' : 'var(--muted)', fontWeight: slipped ? 500 : 400 }}>
            Planned: {fmt.dowMonthDay(when)} · {fmt.time(when)}{slipped ? ' · slipped' : task.replannedFrom ? ' · replanned' : ''}
          </span>
        )}
      </div>
      <select className="est-select" value={task.estimateMin} onChange={(e) => onEstimate(Number(e.target.value))} aria-label={`Estimate for ${task.title}`}>
        {estOptions.map((m) => <option key={m} value={m}>{m} min</option>)}
      </select>
      <StatusButton status={task.status} title={task.title} onClick={onCycle} />
      <div className="task-menu" ref={menuRef}>
        <button type="button" className="icon-btn plain sm" aria-label={`Options for ${task.title}`} aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen(!menuOpen)} data-tour="task-options">
          <Icon name="more" size={18} stroke={3} />
        </button>
        {menuOpen && <div className={`task-menu-popover ${menuAbove ? 'above' : ''}`} style={{ maxHeight: menuMaxHeight }} role="menu" aria-label={`Options for ${task.title}`} onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const current = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
          items[next]?.focus();
        }}>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setAdding(true); }}><Icon name="plus" size={15} /> Add subtask</button>
          <button type="button" role="menuitem" disabled={done} onClick={() => { setMenuOpen(false); onFocus(); }}><Icon name="play" size={15} /> Focus on task</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); titleRef.current?.focus(); titleRef.current?.select(); }}><Icon name="edit" size={15} /> Edit task</button>
          <button type="button" role="menuitem" disabled={first} onClick={() => { setMenuOpen(false); onMove(-1); }}><Icon name="up" size={15} /> Move up</button>
          <button type="button" role="menuitem" disabled={last} onClick={() => { setMenuOpen(false); onMove(1); }}><Icon name="down" size={15} /> Move down</button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}><Icon name="trash" size={15} /> Delete task</button>
        </div>}
      </div>
      </div>
      {(subtasks.length > 0 || adding) && <div className="subtasks">
        {subtasks.length > 0 && <div className="subtasks-caption">{subtasks.filter((subtask) => subtask.done).length} of {subtasks.length} subtasks done</div>}
        <ul className="subtasks-list">
          {subtasks.map((subtask) => <SubtaskRow key={subtask.id} subtask={subtask} onChange={(patch) => onSubtasks((items) => items.map((item) => item.id === subtask.id ? { ...item, ...patch } : item))} onDelete={() => onSubtasks((items) => items.filter((item) => item.id !== subtask.id))} />)}
        </ul>
        {adding && <form className="subtask-add" onSubmit={(event) => {
          event.preventDefault();
          const value = subtaskTitle.trim();
          if (!value) { addRef.current?.focus(); return; }
          const newSubtask = { id: uid('st_'), title: value, done: false };
          onSubtasks((items) => [...items, newSubtask]);
          setSubtaskTitle('');
          setAdding(false);
        }}>
          <input ref={addRef} className="input" aria-label={`New subtask for ${task.title}`} placeholder="Add a small step…" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setAdding(false); setSubtaskTitle(''); } }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
          <button type="button" className="icon-btn plain sm" aria-label="Cancel adding subtask" onClick={() => { setAdding(false); setSubtaskTitle(''); }}><Icon name="x" size={14} /></button>
        </form>}
      </div>}
    </li>
  );
}

function SubtaskRow({ subtask, onChange, onDelete }: { subtask: Subtask; onChange: (patch: Partial<Subtask>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(subtask.title);
  const cancelTitle = useRef(false);
  useEffect(() => setTitle(subtask.title), [subtask.title]);
  return <li className="subtask-row">
    <input type="checkbox" checked={subtask.done} aria-label={`Complete subtask: ${subtask.title}`} onChange={(event) => onChange({ done: event.target.checked })} />
    <input className={`inline-edit ${subtask.done ? 'done' : ''}`} aria-label={`Subtask title: ${subtask.title}`} value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (cancelTitle.current) { cancelTitle.current = false; setTitle(subtask.title); return; } const value = title.trim(); if (!value) setTitle(subtask.title); else if (value !== subtask.title) onChange({ title: value }); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelTitle.current = true; event.currentTarget.blur(); } }} />
    <button type="button" className="icon-btn plain sm" aria-label={`Delete subtask: ${subtask.title}`} onClick={onDelete}><Icon name="trash" size={14} /></button>
  </li>;
}
