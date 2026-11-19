import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Modal, ProgressBar, Segmented } from './ui';
import { useNow, useStore } from '../store/AppStore';
import { parseDay } from '../logic/dates';
import { streak } from '../logic/analytics';
import * as T from '../logic/timer';
import { useDateCopy, useCopy, LanguageToggle, useLanguage } from '../i18n/LanguageContext';

export function Sidebar({ onNewTask, closeControl, modalContainer }: {
  onNewTask: () => void;
  closeControl?: ReactNode;
  modalContainer?: RefObject<HTMLElement>;
}) {
  const copy = useCopy();
  const { fmt, fmtMinutes } = useDateCopy();
  const s = useStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const loc = useLocation();
  const data = s.data!;
  const goal = data.settings.dailyGoalMin;
  const todayDone = s.todayTasks.filter((t) => t.status === 'done').length;
  const days = useMemo(() => streak(data.tasks, s.now), [data.tasks, s.now]);
  const name = s.user?.name ?? '';
  const first = name.split(' ')[0] || name;
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);

  async function resolveConflict() {
    if (resolving) return;
    setResolving(true);
    setResolveFailed(false);
    const success = await s.useServerCopy();
    setResolving(false);
    if (success) setResolveOpen(false);
    else setResolveFailed(true);
  }

  return (
    <nav className="sidebar" aria-label={t('main')}>
      <div className="brand">
        <div className="logo" aria-hidden="true">T</div>
        <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>TinyDo</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{copy("{0}’s workspace", first)}</span>
        </div>
        {closeControl}
      </div>

      <div className="row">
        <SearchBox />
        <button type="button" className="icon-btn" aria-label={t('newTask')} title={t('newTask')} data-tour="quick-task" onClick={onNewTask} style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}>
          <Icon name="plus" size={16} stroke={2.2} />
        </button>
      </div>

      <div className="col" style={{ gap: 4, padding: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
        <span role="status" data-testid="sync-status">{s.syncStatus === 'synced' ? t('allSynced') : s.syncStatus === 'syncing' ? t('syncing') : s.syncStatus === 'retrying' ? t('retrying') : s.syncStatus === 'conflict' ? t('syncConflict') : s.syncStatus === 'error' ? t('syncError') : t('loadingData')}</span>
        {s.syncStatus === 'conflict' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResolveFailed(false); setResolveOpen(true); }}>
            {t('resolveSync')}
          </button>
        )}
        <Modal container={modalContainer?.current} open={resolveOpen} title={t('resolveSync')} onClose={() => { if (!resolving) setResolveOpen(false); }}>
          <div className="modal-body">
            <p>{t('resolveSyncBody')}</p>
            {resolveFailed && <p role="alert">{t('resolveSyncFailed')}</p>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" disabled={resolving} onClick={() => setResolveOpen(false)}>{copy('Cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={resolving} onClick={() => void resolveConflict()}>
              {resolving ? t('loadingData') : t('useServerCopy')}
            </button>
          </div>
        </Modal>
        {s.syncStatus === 'error' && <button type="button" className="btn btn-secondary btn-sm" onClick={s.retrySync}>{t('retrySync')}</button>}
      </div>

      <div className="col nav-list" style={{ gap: 2 }}>
        {s.user?.role === 'admin' && <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="chart" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('adminUsers')}</span>
        </NavLink>}
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="dashboard" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('dashboard')}</span>
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="folder" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('projects')}</span>
          <span className="count">{s.activeProjects.length}</span>
        </NavLink>
        <NavLink to="/calendar" data-tour="calendar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="calendar" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('calendar')}</span>
        </NavLink>
        <NavLink to="/focus" data-tour="focus" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="focus" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('focusMode')}</span>
          <TimerBadge />
        </NavLink>
        <NavLink to="/progress" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="chart" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('progress')}</span>
        </NavLink>
        <NavLink to="/teams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="users" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>{t('teams')}</span>
        </NavLink>
      </div>

      <div className="col" style={{ gap: 2 }}>
        <div className="side-head">
          <span>{t('projectList')}</span>
          <span>{t('due')}</span>
        </div>
        {s.activeProjects.length === 0 && (
          <button type="button" className="side-proj" style={{ border: 0, background: 'transparent', color: 'var(--muted)', textAlign: 'left' }} onClick={() => navigate('/projects?new=1')}>
            <Icon name="plus" size={14} />
            <span className="name">{t('createFirstProject')}</span>
          </button>
        )}
        {s.activeProjects.map((p) => {
          const st = s.stats.get(p.id);
          const late = st?.risk === 'overdue';
          const active = loc.pathname === `/projects/${p.id}`;
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className={`side-proj ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <span className="dot" style={{ background: p.color }} />
              <span className="name">{p.name}</span>
              <span className={`due ${late ? 'late' : ''}`}>{late ? t('overdue') : fmt.monthDay(parseDay(p.dueDate))}</span>
            </Link>
          );
        })}
      </div>

      <div className="spacer" style={{ flex: 1 }} />

      <div className="card" style={{ borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>{t('todayFocus')}</span>
          <span className="muted tnum" data-testid="sidebar-focus">{fmtMinutes(s.todayFocusMin)} / {fmtMinutes(goal)}</span>
        </div>
        <ProgressBar pct={(s.todayFocusMin / goal) * 100} height={6} label={t('focusGoal')} />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {days > 0 ? `${days} ${t('dayStreak')}` : t('noStreak')} · {todayDone} {todayDone === 1 ? t('task') : t('tasks')} {t('done')}
        </span>
      </div>

      <div>
      <div style={{ marginBottom: 8 }}><LanguageToggle /></div>
      <Segmented
        label={t('theme')}
        full
        value={s.theme}
        onChange={(t) => s.setTheme(t)}
        options={[
          { value: 'light', label: <><Icon name="sun" size={15} />{t('light')}</> },
          { value: 'dark', label: <><Icon name="moon" size={15} />{t('dark')}</> },
        ]}
      />
      </div>

      <div className="row" style={{ gap: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <NavLink to="/profile" aria-label={t('profileSettings')} className={({ isActive }) => `profile-link ${isActive ? 'active' : ''}`}>
          <Avatar />
          <div className="col" style={{ gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('profileSettings')}</span>
          </div>
        </NavLink>
        <button
          type="button"
          className="icon-btn plain"
          aria-label={t('logout')}
          title={t('logout')}
          style={{ width: 36, height: 36, color: 'var(--muted)' }}
          onClick={() => {
            s.logOut();
            navigate('/login');
          }}
        >
          <Icon name="logout" size={17} stroke={1.9} />
        </button>
      </div>
    </nav>
  );
}

export function Avatar({ size }: { size?: 'xl' }) {
  const s = useStore();
  const u = s.user;
  const initial = (u?.name.trim()[0] ?? '?').toUpperCase();
  return (
    <div className={`avatar ${size ?? ''}`} aria-hidden="true" style={u?.avatar ? { background: `center / cover no-repeat url(${u.avatar})` } : undefined}>
      {!u?.avatar && initial}
    </div>
  );
}

function TimerBadge() {
  const copy = useCopy();
  const s = useStore();
  const now = useNow(1000);
  const t = s.data?.meta.timer;
  if (!t || (!t.running && T.isPristine(t))) return null;
  return (
    <span className={`pill ${t.running ? 'in_progress' : 'todo'} tnum`} style={{ padding: '2px 7px', fontSize: 11 }} aria-label={t.running ? copy("Focus timer running") : copy("Focus timer paused")}>
      {T.clock(T.remainingMs(t, now.getTime()))}
    </span>
  );
}

interface Result {
  kind: 'project' | 'task';
  id: string;
  title: string;
  sub: string;
  color: string;
  to: string;
}

function SearchBox() {
  const { fmt } = useDateCopy();
  const s = useStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const input = inputRef.current;
        if (!input || !input.getClientRects().length) return;
        e.preventDefault();
        input.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term || !s.data) return [];
    const projects = s.data.projects
      .filter((p) => p.name.toLowerCase().includes(term))
      .slice(0, 5)
      .map((p) => ({ kind: 'project' as const, id: p.id, title: p.name, sub: p.completedAt ? t('completed') : fmt.monthDay(parseDay(p.dueDate)), color: p.color, to: `/projects/${p.id}` }));
    const byId = new Map(s.data.projects.map((p) => [p.id, p]));
    const tasks = s.data.tasks
      .filter((task) => task.title.toLowerCase().includes(term))
      .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
      .slice(0, 8)
      .map((task) => {
        const p = byId.get(task.projectId);
        return { kind: 'task' as const, id: task.id, title: task.title, sub: `${p?.name ?? ''}${task.status === 'done' ? ` · ${t('done')}` : ''}`, color: p?.color ?? 'var(--control)', to: `/projects/${task.projectId}?task=${task.id}` };
      });
    return [...projects, ...tasks];
  }, [q, s.data, t]);

  useEffect(() => setSel(0), [q]);

  const go = (r: Result) => {
    navigate(r.to);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const listId = 'search-results';
  return (
    <div className="search-box" ref={boxRef}>
      <label className="search">
        <Icon name="search" size={15} />
        <input
          ref={inputRef}
          type="search"
          placeholder={t('search')}
          aria-label={t('searchAria')}
          role="combobox"
          aria-expanded={open && q.trim().length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[sel] ? `sr-${results[sel].id}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && results[sel]) {
              e.preventDefault();
              go(results[sel]);
            } else if (e.key === 'Escape' && open && q.trim()) {
              e.preventDefault();
              setOpen(false);
              setQ('');
              inputRef.current?.blur();
            }
          }}
        />
        <span className="kbd" aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</span>
      </label>
      {open && q.trim() && (
        <div className="popover" id={listId} role="listbox" aria-label={t('searchResults')}>
          {results.length === 0 && <div className="empty-row empty" style={{ padding: 12, alignItems: 'flex-start' }}>{t('noMatches')} “{q.trim()}”.</div>}
          {results.some((r) => r.kind === 'project') && <div className="group" role="presentation">{t('projectList')}</div>}
          {results.map((r, i) => (
            <div key={r.kind + r.id}>
              {r.kind === 'task' && i > 0 && results[i - 1].kind === 'project' && <div className="group" role="presentation">{t('taskList')}</div>}
              {r.kind === 'task' && i === 0 && <div className="group" role="presentation">{t('taskList')}</div>}
              <button
                type="button"
                id={`sr-${r.id}`}
                role="option"
                aria-selected={i === sel}
                className="opt"
                tabIndex={-1}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
              >
                <span className={`dot ${r.kind === 'task' ? 'round' : ''}`} style={{ background: r.color }} />
                <span className="t">{r.title}</span>
                <span className="s">{r.sub}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
