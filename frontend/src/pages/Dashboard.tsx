import { useCopy, useDateCopy, useLanguage } from '../i18n/LanguageContext';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Page, useUI } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { CheckButton, EmptyState, ProgressBar, RiskPill, StatusButton, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { addDays, dayKey, daysBetween, parseDay, startOfWeek } from '../logic/dates';
import { focusByDay } from '../logic/analytics';

export function DashboardPage() {
  const copy = useCopy();
  const { language } = useLanguage();
  const { fmt, fmtMinutes, greeting, relDay, relDue } = useDateCopy();
  function joinDays(dates: Date[], now: Date): string {
    const keys = Array.from(new Set(dates.map((d) => dayKey(d)))).sort();
    const labels = keys.slice(0, 3).map((k) => {
      const d = parseDay(k);
      const r = relDay(d, now);
      return [0, 1].includes(daysBetween(now, d)) ? r.toLowerCase() : fmt.dowMonthDay(d);
    });
    if (keys.length > 3) labels.push(copy('{0} more {1}', keys.length - 3, copy(keys.length - 3 === 1 ? 'day' : 'days')));
    return new Intl.ListFormat(language === 'vi' ? 'vi-VN' : 'en-US').format(labels);
  }

  useDocumentTitle(copy("Dashboard"));
  const s = useStore();
  const ui = useUI();
  const toast = useToast();
  const data = s.data!;
  const now = s.now;
  const goal = data.settings.dailyGoalMin;
  const first = (s.user?.name ?? '').split(' ')[0];

  // Overdue banner: first overdue active project not snoozed today.
  const overdue = s.activeProjects.filter((p) => s.stats.get(p.id)?.risk === 'overdue');
  const banner = overdue.find((p) => data.meta.snoozedAlerts[p.id] !== dayKey(now));
  const bannerStats = banner ? s.stats.get(banner.id)! : null;

  const weekEnd = dayKey(addDays(now, 6));
  const dueThisWeek = s.activeProjects.filter((p) => p.dueDate >= dayKey(now) && p.dueDate <= weekEnd);
  const highDue = dueThisWeek.filter((p) => p.priority === 'high').length;

  const today = s.todayTasks;
  const doneToday = today.filter((t) => t.status === 'done').length;
  const projectById = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);

  const weekStart = startOfWeek(now, data.settings.weekStart);
  const week = focusByDay(data.sessions, weekStart, 7);
  const weekTotal = week.reduce((a, b) => a + b, 0);
  const weekMax = Math.max(goal, ...week);

  // Auto-replan suggestions.
  const slipped = s.replanPreview;
  const movable = slipped.filter((p) => p.to);
  const slippedProjects = Array.from(new Set(slipped.map((p) => data.tasks.find((t) => t.id === p.taskId)?.projectId)));
  const behind = s.activeProjects
    .map((p) => ({ p, st: s.stats.get(p.id)! }))
    .filter(({ st }) => st.risk === 'at_risk' && st.neededPerDay > st.pace * 1.2)
    .slice(0, 2);

  const replanToday = (projectId: string, name: string) => {
    const r = s.replanProjectToToday(projectId);
    toast({
      tone: r.unplaced ? 'warn' : 'ok',
      title: r.placed ? copy("Moved {0} {1} {2} into today", r.placed, name, r.placed === 1 ? copy("task") : copy("tasks")) : copy("No free slots left today"),
      body: r.unplaced ? copy("{0} didn’t fit in today’s focus goal. Raise the goal or trim scope.", r.unplaced) : copy("Check the Calendar for the new slots."),
      action: r.placed ? { label: copy("Undo"), onClick: () => s.undoReplan() } : undefined,
    });
  };

  const isEmpty = data.projects.length === 0;

  return (
    <Page label={copy("Dashboard")} className="dashboard-page">
      <header className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <span className="meta">{fmt.longDate(now)}</span>
          <h1 className="page-title">{greeting(now)}, {first}</h1>
        </div>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isEmpty}
            onClick={() => {
              const r = s.planMyDay();
              toast({
                tone: r.placed ? 'ok' : 'info',
                title: r.placed ? copy("Planned {0} {1}", r.placed, r.placed === 1 ? copy("task") : copy("tasks")) : r.unplaced ? copy("No tasks fit before their deadlines") : copy("Everything is already scheduled"),
                body: r.unplaced ? copy("{0} didn’t fit before their deadlines.", r.unplaced) : r.placed ? copy("Scheduled from today onward using your working hours and days off.") : copy("Add tasks or raise your daily goal to plan more."),
                action: r.placed ? { label: copy("Undo"), onClick: () => s.undoReplan() } : undefined,
              });
            }}
          >
            <Icon name="calendar" size={16} style={{ color: 'var(--accent-text)' }} />
            {copy("Plan tasks")}
          </button>
          <button type="button" className="btn btn-primary" onClick={ui.openNewProject} data-tour="new-project">
            <Icon name="plus" size={16} stroke={2.2} />
            {copy("New project")}
          </button>
        </div>
      </header>

      {banner && bannerStats && (
        <div className="alert" role="alert">
          <div className="ico"><Icon name="alert" size={18} /></div>
          <div className="col" style={{ flex: '1 1 280px', gap: 2 }}>
            <span className="t">
              {banner.name} {copy("is")} {Math.max(1, -daysBetween(now, parseDay(banner.dueDate)))} {Math.max(1, -daysBetween(now, parseDay(banner.dueDate))) === 1 ? 'day' : 'days'} {copy("overdue")}
            </span>
            <span className="b">
              {bannerStats.total - bannerStats.done} {copy(bannerStats.total - bannerStats.done === 1 ? 'task' : 'tasks')} {copy("left · about")} {fmtMinutes(bannerStats.remainingMin)}{copy(". Replanning moves them into today’s first free slots.")}
            </span>
          </div>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-md" onClick={() => { s.snoozeAlert(banner.id); toast({ title: copy("Snoozed until tomorrow") }); }}>{copy("Snooze")}</button>
            <button type="button" className="btn btn-danger btn-md" onClick={() => replanToday(banner.id, banner.name)}>{copy("Replan to today")}</button>
          </div>
        </div>
      )}

      {isEmpty ? (
        <section className="card">
          <EmptyState icon="folder" title={copy("Start with one project")} body={copy("Add something with a deadline, split it into 10–15 minute tasks, and Plan my day places them in your week.")}>
            <button type="button" className="btn btn-primary" onClick={ui.openNewProject}><Icon name="plus" size={16} />{copy("New project")}</button>
          </EmptyState>
        </section>
      ) : (
        <>
          <section aria-label={copy("Key numbers")} className="grid-kpi stagger">
            <div className="card kpi">
              <span className="label">{copy("Due this week")}</span>
              <span className="value">{dueThisWeek.length}</span>
              <span className="sub">{dueThisWeek.length ? (highDue ? copy("{0} high priority", highDue) : copy("Next: {0}", dueThisWeek[0].name)) : copy("Nothing due in the next 7 days")}</span>
            </div>
            <div className="card kpi">
              <span className="label">{copy("Overdue")}</span>
              <span className="value" style={{ color: overdue.length ? 'var(--danger-text)' : undefined }}>{overdue.length}</span>
              <span className="sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{overdue.length ? overdue.map((p) => p.name).join(', ') : copy("All deadlines on time")}</span>
            </div>
            <div className="card kpi">
              <span className="label">{copy("Focus today")}</span>
              <span className="value" data-testid="kpi-focus">{fmtMinutes(s.todayFocusMin)}</span>
              <ProgressBar pct={(s.todayFocusMin / goal) * 100} label={copy("Focus today versus daily goal")} />
            </div>
            <div className="card kpi">
              <span className="label">{copy("Today’s plan")}</span>
              <span className="value" data-testid="kpi-plan">{doneToday}<small> / {today.length} {copy("done")}</small></span>
              <ProgressBar pct={today.length ? (doneToday / today.length) * 100 : 0} color="var(--ok-strong)" label={copy("Today’s tasks done")} />
            </div>
          </section>

          <div className="grid-2">
            <section aria-labelledby="today-h" className="card clip">
              <div className="card-head">
                <h2 id="today-h" className="section-title">{copy("Today · 10–15 min tasks")}</h2>
                <Link to="/focus" className="link">{copy("Start focus →")}</Link>
              </div>
              {today.length === 0 ? (
                <EmptyState icon="calendar" title={copy("Nothing scheduled today")} body={copy("Plan my day fills today’s free slots from your projects, earliest deadline first.")}>
                  <button type="button" className="btn btn-secondary btn-md" onClick={() => { const r = s.planMyDay(); toast({ tone: r.placed ? 'ok' : 'info', title: r.placed ? copy("Planned {0} tasks", r.placed) : copy("Nothing left to schedule") }); }}>{copy("Plan my day")}</button>
                </EmptyState>
              ) : (
                <ul className="task-list">
                  {today.map((t) => {
                    const p = projectById.get(t.projectId);
                    const done = t.status === 'done';
                    return (
                      <li key={t.id} className="task-row">
                        <CheckButton done={done} title={t.title} onClick={() => s.toggleTaskDone(t.id)} />
                        <div className="grow">
                          <Link to={`/projects/${t.projectId}?task=${t.id}`} className={`title ${done ? 'done' : ''}`} style={{ textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--muted)' : 'var(--text)' }}>{t.title}</Link>
                          <span className="meta">{p?.name} · {fmt.time(new Date(t.scheduledFor!))}{t.replannedFrom ? ` · ${copy('replanned')}` : ''}</span>
                        </div>
                        <span className="est">{t.estimateMin}m</span>
                        <StatusButton status={t.status} title={t.title} onClick={() => s.cycleStatus(t.id)} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="dl-h" className="card clip">
              <div className="card-head">
                <h2 id="dl-h" className="section-title">{copy("Upcoming deadlines")}</h2>
                <Link to="/calendar" className="link">{copy("Calendar →")}</Link>
              </div>
              {s.activeProjects.length === 0 ? (
                <EmptyState icon="flag" title={copy("No active projects")} body={copy("Completed projects live on the Projects page.")} />
              ) : (
                <div className="col">
                  {s.activeProjects.slice(0, 6).map((p) => {
                    const st = s.stats.get(p.id)!;
                    const late = st.risk === 'overdue';
                    return (
                      <Link key={p.id} to={`/projects/${p.id}`} className="dl-item">
                        <div className="row" style={{ gap: 10 }}>
                          <span className="dot" style={{ background: p.color }} />
                          <span className="name">{p.name}</span>
                          <RiskPill risk={st.risk} />
                        </div>
                        <div className="row" style={{ gap: 10, paddingLeft: 18 }}>
                          <ProgressBar pct={st.pct} color={p.color} label={copy("{0} progress", p.name)} />
                          <span className="pct">{st.pct}%</span>
                          <span className={`due ${late ? 'late' : ''}`}>{late ? fmt.monthDay(parseDay(p.dueDate)) : relDue(p.dueDate, now)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="grid-2 stretch">
            <section aria-labelledby="wk-h" className="card pad col" style={{ gap: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 id="wk-h" className="section-title">{copy("Focus this week")}</h2>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{fmtMinutes(weekTotal)} {copy("· goal")} {fmtMinutes(goal * 7)}</span>
              </div>
              <div className="week-bars" role="img" aria-label={copy("Focus minutes per day: {0}", week.map((m, i) => `${fmt.dow(addDays(weekStart, i))} ${m}`).join(', '))}>
                {week.map((m, i) => {
                  const d = addDays(weekStart, i);
                  const isToday = dayKey(d) === dayKey(now);
                  const future = d.getTime() > now.getTime() && !isToday;
                  return (
                    <div key={i} className="d">
                      <span className="v">{m ? fmtMinutes(m) : ''}</span>
                      <div className={`b ${m === 0 ? 'zero' : isToday ? 'today' : ''}`} style={{ height: Math.max(4, Math.round((m / weekMax) * 100)), animationDelay: `${i * 40}ms`, opacity: future ? 0.6 : 1 }} />
                      <span className={`l ${isToday ? 'today' : ''}`}>{fmt.dow(d)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="rp-h" className="card pad col" style={{ gap: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 id="rp-h" className="section-title">{copy("Auto-replan")}</h2>
                {(slipped.length > 0 || behind.length > 0) && (
                  <span className="pill accent">{(slipped.length ? 1 : 0) + behind.length} {(slipped.length ? 1 : 0) + behind.length === 1 ? 'suggestion' : 'suggestions'}</span>
                )}
              </div>
              {slipped.length === 0 && behind.length === 0 ? (
                <div className="suggestion">
                  <Icon name="check" size={18} style={{ flex: 'none', marginTop: 1, color: 'var(--ok-strong)' }} />
                  <div className="col" style={{ gap: 4 }}>
                    <span className="t">{copy("You’re caught up")}</span>
                    <span className="b">{copy("No unfinished tasks from earlier days, and every project’s pace covers its deadline.")}</span>
                  </div>
                </div>
              ) : (
                <>
                  {slipped.length > 0 && (
                    <div className="suggestion">
                      <Icon name="refresh" size={18} style={{ flex: 'none', marginTop: 1, color: 'var(--accent-text)' }} />
                      <div className="col" style={{ gap: 4 }}>
                        <span className="t">
                          {copy("Move")} {slipped.length} {copy("unfinished")} {slippedProjects.length === 1 ? projectById.get(slippedProjects[0]!)?.name.split(' ')[0] + ' ' : ''}
                          {slipped.length === 1 ? 'task' : 'tasks'} {copy("from earlier days")}
                        </span>
                        <span className="b">
                          {movable.length
                            ? copy("Spread across {0} within your daily goal.", joinDays(movable.map((m) => new Date(m.to!)), now))
                            : copy("No free slots before their deadlines. Raise your daily goal or trim scope.")}
                          {movable.length < slipped.length && movable.length > 0 ? " " + copy("{0} won’t fit before the deadline.", slipped.length - movable.length) : ''}
                        </span>
                      </div>
                    </div>
                  )}
                  {behind.map(({ p, st }) => (
                    <div key={p.id} className="suggestion">
                      <Icon name="clock" size={18} style={{ flex: 'none', marginTop: 1, color: p.color }} />
                      <div className="col" style={{ gap: 4 }}>
                        <span className="t">{p.name} {copy("needs")} {fmtMinutes(st.neededPerDay)} {copy("per day")}</span>
                        <span className="b">
                          {st.daysLate > 0
                            ? copy("At your current pace ({0}/day) it finishes {1}, {2} {3} late. Trim scope or add sessions.", fmtMinutes(st.pace), fmt.monthDay(st.projectedFinish), st.daysLate, st.daysLate === 1 ? copy("day") : copy("days"))
                            : copy("Your recent pace is {0}/day. Add a session or two to keep a buffer.", fmtMinutes(st.pace))}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="row" style={{ marginTop: 'auto' }}>
                    {movable.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-dark btn-md"
                        onClick={() => {
                          const n = s.applyReplan();
                          toast({ tone: 'ok', title: copy("Moved {0} {1}", n, n === 1 ? copy("task") : copy("tasks")), action: { label: copy("Undo"), onClick: () => s.undoReplan() } });
                        }}
                      >
                        {copy("Apply replan")}
                      </button>
                    )}
                    <Link to="/progress" className="btn btn-secondary btn-md">{copy("Review")}</Link>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </Page>
  );
}
