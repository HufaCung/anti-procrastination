import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page, useUI } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { EmptyState, ProgressBar, RiskPill, Segmented, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { fmt, fmtMinutes, parseDay, relDue } from '../logic/dates';
import { PRIORITY_LABEL } from '../logic/progress';

type Filter = 'active' | 'completed' | 'all';

export function ProjectsPage() {
  useDocumentTitle('Projects');
  const s = useStore();
  const ui = useUI();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('active');
  const data = s.data!;

  useEffect(() => {
    if (params.get('new') === '1') {
      ui.openNewProject();
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams, ui]);

  const list = useMemo(() => {
    const all = [...data.projects].sort((a, b) => {
      if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
      if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
      return a.dueDate === b.dueDate ? a.name.localeCompare(b.name) : a.dueDate < b.dueDate ? -1 : 1;
    });
    if (filter === 'active') return all.filter((p) => !p.completedAt);
    if (filter === 'completed') return all.filter((p) => p.completedAt);
    return all;
  }, [data.projects, filter]);

  const completedCount = data.projects.filter((p) => p.completedAt).length;

  return (
    <Page label="Projects">
      <header className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h1 className="page-title">Projects</h1>
          <span className="meta">{s.activeProjects.length} active · {completedCount} completed</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={ui.openNewProject}>
          <Icon name="plus" size={16} stroke={2.2} />
          New project
        </button>
      </header>

      {data.projects.length > 0 && (
        <div className="filter-row">
          <Segmented label="Show projects" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }]} />
        </div>
      )}

      {data.projects.length === 0 ? (
        <section className="card">
          <EmptyState icon="folder" title="No projects yet" body="Create a project with a deadline, then add the 10–15 minute tasks it takes to finish.">
            <button type="button" className="btn btn-primary" onClick={ui.openNewProject}><Icon name="plus" size={16} />New project</button>
          </EmptyState>
        </section>
      ) : list.length === 0 ? (
        <section className="card">
          <EmptyState icon={filter === 'completed' ? 'check' : 'folder'} title={filter === 'completed' ? 'Nothing completed yet' : 'No active projects'} body={filter === 'completed' ? 'Finish every task in a project and it lands here.' : 'Everything is done. Start something new?'} />
        </section>
      ) : (
        <div className="proj-grid stagger" key={filter}>
          {list.map((p) => {
            const st = s.stats.get(p.id)!;
            const late = st.risk === 'overdue';
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card proj-card">
                <div className="row" style={{ gap: 10 }}>
                  <span className="dot lg" style={{ background: p.color }} />
                  <span className="n">{p.name}</span>
                  <RiskPill risk={st.risk} />
                </div>
                <span className="desc">{p.description || `${PRIORITY_LABEL[p.priority]} · ${st.total} tasks`}</span>
                <div className="row" style={{ gap: 10 }}>
                  <ProgressBar pct={st.pct} color={p.color} height={6} label={`${p.name} progress`} />
                  <span className="tnum" style={{ fontSize: 12, color: 'var(--muted)', width: 34, textAlign: 'right' }}>{st.pct}%</span>
                </div>
                <div className="foot">
                  <span className="tnum">{st.done}/{st.total} tasks{st.remainingMin ? ` · ${fmtMinutes(st.remainingMin)} left` : ''}</span>
                  <span style={late ? { color: 'var(--danger-text)', fontWeight: 600 } : undefined}>
                    {p.completedAt ? `Done ${fmt.monthDay(new Date(p.completedAt))}` : late ? `Due ${fmt.monthDay(parseDay(p.dueDate))}` : relDue(p.dueDate, s.now)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
