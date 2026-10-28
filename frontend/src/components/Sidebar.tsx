import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { ProgressBar, Segmented } from './ui';
import { useNow, useStore } from '../store/AppStore';
import { fmt, fmtMinutes, parseDay } from '../logic/dates';
import { streak } from '../logic/analytics';
import * as T from '../logic/timer';

export function Sidebar({ onNewTask }: { onNewTask: () => void }) {
  const s = useStore();
  const navigate = useNavigate();
  const loc = useLocation();
  const data = s.data!;
  const goal = data.settings.dailyGoalMin;
  const todayDone = s.todayTasks.filter((t) => t.status === 'done').length;
  const days = useMemo(() => streak(data.tasks, s.now), [data.tasks, s.now]);
  const name = s.user?.name ?? '';
  const first = name.split(' ')[0] || name;
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [loc.pathname]);

  return (
    <nav className={`sidebar ${more ? 'more-open' : ''}`} aria-label="Main">
      <div className="brand">
        <div className="logo" aria-hidden="true">T</div>
        <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>TinyDo</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first}’s workspace</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm mobile-only" aria-expanded={more} aria-controls="side-more" onClick={() => setMore((m) => !m)}>
          {more ? 'Less' : 'More'}
          <Icon name={more ? 'up' : 'down'} size={14} />
        </button>
      </div>

      <div className="row">
        <SearchBox />
        <button type="button" className="icon-btn" aria-label="New task" title="New task" onClick={onNewTask} style={{ background: 'var(--accent)', color: '#fff', borderColor: 'transparent' }}>
          <Icon name="plus" size={16} stroke={2.2} />
        </button>
      </div>

      <div className="col nav-list" style={{ gap: 2 }}>
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="dashboard" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>Dashboard</span>
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="folder" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>Projects</span>
          <span className="count">{s.activeProjects.length}</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="calendar" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>Calendar</span>
        </NavLink>
        <NavLink to="/focus" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="focus" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>Focus Mode</span>
          <TimerBadge />
        </NavLink>
        <NavLink to="/progress" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon name="chart" size={17} stroke={1.9} />
          <span style={{ flex: 1 }}>Progress</span>
        </NavLink>
      </div>

      <div id="side-more" className="col mobile-extra" style={{ gap: 2 }}>
        <div className="side-head">
          <span>PROJECTS</span>
          <span>Due</span>
        </div>
        {s.activeProjects.length === 0 && (
          <button type="button" className="side-proj" style={{ border: 0, background: 'transparent', color: 'var(--muted)', textAlign: 'left' }} onClick={() => navigate('/projects?new=1')}>
            <Icon name="plus" size={14} />
            <span className="name">Create your first project</span>
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
              <span className={`due ${late ? 'late' : ''}`}>{late ? 'Overdue' : fmt.monthDay(parseDay(p.dueDate))}</span>
            </Link>
          );
        })}
      </div>

      <div className="spacer" style={{ flex: 1 }} />

      <div className="card mobile-extra" style={{ borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ fontWeight: 600 }}>Today’s focus</span>
          <span className="muted tnum" data-testid="sidebar-focus">{fmtMinutes(s.todayFocusMin)} / {fmtMinutes(goal)}</span>
        </div>
        <ProgressBar pct={(s.todayFocusMin / goal) * 100} height={6} label="Today’s focus versus goal" />
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {days > 0 ? `${days}-day streak` : 'No streak yet'} · {todayDone} {todayDone === 1 ? 'task' : 'tasks'} done
        </span>
      </div>

      <div className="mobile-extra">
      <Segmented
        label="Theme"
        full
        value={s.theme}
        onChange={(t) => s.setTheme(t)}
        options={[
          { value: 'light', label: <><Icon name="sun" size={15} />Light</> },
          { value: 'dark', label: <><Icon name="moon" size={15} />Dark</> },
        ]}
      />
      </div>

      <div className="row mobile-extra" style={{ gap: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <NavLink to="/profile" aria-label="Profile and settings" className={({ isActive }) => `profile-link ${isActive ? 'active' : ''}`}>
          <Avatar />
          <div className="col" style={{ gap: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Profile &amp; settings</span>
          </div>
        </NavLink>
        <button
          type="button"
          className="icon-btn plain"
          aria-label="Log out"
          title="Log out"
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
  const s = useStore();
  const now = useNow(1000);
  const t = s.data?.meta.timer;
  if (!t || (!t.running && T.isPristine(t))) return null;
  return (
    <span className={`pill ${t.running ? 'in_progress' : 'todo'} tnum`} style={{ padding: '2px 7px', fontSize: 11 }} aria-label={t.running ? 'Focus timer running' : 'Focus timer paused'}>
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
  const s = useStore();
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
        e.preventDefault();
        inputRef.current?.focus();
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
      .map((p) => ({ kind: 'project' as const, id: p.id, title: p.name, sub: p.completedAt ? 'Completed' : fmt.monthDay(parseDay(p.dueDate)), color: p.color, to: `/projects/${p.id}` }));
    const byId = new Map(s.data.projects.map((p) => [p.id, p]));
    const tasks = s.data.tasks
      .filter((t) => t.title.toLowerCase().includes(term))
      .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
      .slice(0, 8)
      .map((t) => {
        const p = byId.get(t.projectId);
        return { kind: 'task' as const, id: t.id, title: t.title, sub: `${p?.name ?? ''}${t.status === 'done' ? ' · done' : ''}`, color: p?.color ?? 'var(--control)', to: `/projects/${t.projectId}?task=${t.id}` };
      });
    return [...projects, ...tasks];
  }, [q, s.data]);

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
          placeholder="Search"
          aria-label="Search tasks and projects"
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
            } else if (e.key === 'Escape') {
              setOpen(false);
              setQ('');
              inputRef.current?.blur();
            }
          }}
        />
        <span className="kbd" aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</span>
      </label>
      {open && q.trim() && (
        <div className="popover" id={listId} role="listbox" aria-label="Search results">
          {results.length === 0 && <div className="empty-row empty" style={{ padding: 12, alignItems: 'flex-start' }}>No matches for “{q.trim()}”.</div>}
          {results.some((r) => r.kind === 'project') && <div className="group" role="presentation">PROJECTS</div>}
          {results.map((r, i) => (
            <div key={r.kind + r.id}>
              {r.kind === 'task' && i > 0 && results[i - 1].kind === 'project' && <div className="group" role="presentation">TASKS</div>}
              {r.kind === 'task' && i === 0 && <div className="group" role="presentation">TASKS</div>}
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
