import { useCopy, useDateCopy, useLanguage } from '../i18n/LanguageContext';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { EmptyState, ProgressBar, RiskPill, Segmented, Switch, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { addDays, dayKey, parseDay } from '../logic/dates';
import { heatmap, rangeKpis, streak } from '../logic/analytics';
import { riskLabel } from '../i18n/progress';
import { projectStats } from '../logic/progress';
import { applyPlacements } from '../logic/schedule';

type Range = '7d' | '30d';

export function ProgressPage() {
  const copy = useCopy();
  const { t, language } = useLanguage();
  const { fmt, fmtMinutes, fmtMinutesPadded, fmtSlot, relDay } = useDateCopy();
  function delta(cur: number, prev: number, unit: 'pct' | 'min', label: string): { text: string; tone: 'ok' | 'bad' | null } {
    if (unit === 'min') {
      const d = cur - prev;
      if (d === 0) return { text: copy("Same as {0}", label), tone: null };
      return { text: copy('{0}{1} vs {2}', d > 0 ? '+' : '−', fmtMinutes(Math.abs(d)), label), tone: d > 0 ? 'ok' : 'bad' };
    }
    if (prev === 0) return cur ? { text: copy("Up from 0 {0}", label), tone: 'ok' } : { text: copy("None {0} either", label), tone: null };
    const p = Math.round(((cur - prev) / prev) * 100);
    if (p === 0) return { text: copy("Same as {0}", label), tone: null };
    return { text: copy('{0}{1}% vs {2}', p > 0 ? '+' : '−', Math.abs(p), label), tone: p > 0 ? 'ok' : 'bad' };
  }
  useDocumentTitle(copy("Progress"));
  const s = useStore();
  const toast = useToast();
  const data = s.data!;
  const now = s.now;
  const [range, setRange] = useState<Range>('7d');
  const days = range === '7d' ? 7 : 30;
  const goal = data.settings.dailyGoalMin;

  const k = useMemo(() => rangeKpis(data, days, now), [data, days, now]);
  const heat = useMemo(() => heatmap(data.tasks, now, data.settings.weekStart), [data.tasks, now, data.settings.weekStart]);
  const streakDays = useMemo(() => streak(data.tasks, now), [data.tasks, now]);
  const prevLabel = range === '7d' ? copy("last week") : copy('prior 30 days');

  const tasksDelta = delta(k.tasksCompleted, k.tasksCompletedPrev, 'pct', prevLabel);
  const focusDelta = delta(k.focusMin, k.focusMinPrev, 'min', prevLabel);
  const ot = k.onTime;

  const kpis = [
    { label: copy("Tasks completed"), value: String(k.tasksCompleted), sub: tasksDelta.text, tone: tasksDelta.tone },
    { label: copy("Focus time"), value: fmtMinutes(k.focusMin), sub: focusDelta.text, tone: focusDelta.tone },
    { label: copy("Avg. session"), value: k.sessionsCount ? copy("{0} min", Math.round(k.avgSessionMin)) : '—', sub: copy("{0} sessions · target 10–15 min", k.sessionsCount), tone: null },
    {
      label: copy("On-time rate"),
      value: ot.rate == null ? '—' : `${Math.round(ot.rate * 100)}%`,
      sub: ot.total === 0 ? copy("No deadlines in this range") : ot.missed ? copy("{0} of {1} {2} missed", ot.missed, ot.total, ot.total === 1 ? 'deadline' : 'deadlines') : copy("All {0} deadlines met", ot.total),
      tone: ot.total === 0 ? null : ot.missed ? ('bad' as const) : ('ok' as const),
    },
  ];

  const maxBar = Math.max(goal * 1.5, ...k.focusPerDay);
  const chartH = 180;
  const labels = k.focusPerDay.map((_, i) => {
    const d = addDays(k.from, i);
    if (range === '7d') return fmt.dow(d);
    return i % 7 === 1 || i === days - 1 ? String(d.getDate()) : '';
  });

  // Projects table: active first, then recently finished ones in range.
  const rows = [...s.activeProjects, ...data.projects.filter((p) => p.completedAt && new Date(p.completedAt) >= k.from)];

  // Replan section.
  const preview = s.replanPreview;
  const last = data.meta.lastReplan;
  const [justApplied, setJustApplied] = useState(false);
  const lastToday = !!last && last.entries.length > 0 && dayKey(new Date(last.at)) === dayKey(now);
  const appliedView = lastToday && (justApplied || !preview.some((p) => p.to));
  const shownRows = appliedView
    ? last!.entries.map((e) => {
        const t = data.tasks.find((x) => x.id === e.taskId);
        return t ? { taskId: t.id, from: e.scheduledFor, to: t.scheduledFor } : null;
      }).filter(Boolean) as { taskId: string; from?: string; to?: string }[]
    : preview;
  const projectById = new Map(data.projects.map((p) => [p.id, p]));

  // "What changes" note: projected finish of the most affected project after applying.
  const note = useMemo(() => {
    if (appliedView || preview.length === 0) return null;
    const movable = preview.filter((p) => p.to);
    if (!movable.length) return copy("None of these fit before their deadlines. Raise your daily goal or trim scope.");
    const after = applyPlacements(data.tasks, movable, true).tasks;
    const pids = Array.from(new Set(movable.map((m) => data.tasks.find((t) => t.id === m.taskId)?.projectId)));
    const p = projectById.get(pids[0]!);
    if (!p) return null;
    const before = s.stats.get(p.id);
    const st = projectStats({ project: p, tasks: after.filter((t) => t.projectId === p.id), sessions: data.sessions, dailyGoalMin: goal, activeProjectsCount: s.activeProjects.length, now });
    if (before && before.risk !== st.risk) return copy("{0} goes from {1} to {2} if applied.", p.name, riskLabel(before.risk, language).toLowerCase(), riskLabel(st.risk, language).toLowerCase());
    return copy("Moves {0} {1} into free slots before their deadlines.", movable.length, movable.length === 1 ? copy("task") : copy("tasks"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, appliedView, data.tasks, now, copy, language]);

  return (
    <Page label={copy("Progress")}>
      <header className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <h1 className="page-title">{t('progress')}</h1>
          <span className="meta" data-testid="range-text">{fmt.dowMonthDay(k.from)} – {fmt.dowMonthDay(addDays(k.toExcl, -1))}</span>
        </div>
        <Segmented label={copy("Range")} value={range} onChange={setRange} options={[{ value: '7d', label: copy("Last 7 days") }, { value: '30d', label: copy("Last 30 days") }]} />
      </header>

      <section aria-label={copy("Summary")} className="grid-kpi">
        {kpis.map((x) => (
          <div key={x.label} className="card kpi">
            <span className="label">{x.label}</span>
            <span className="value" style={{ fontSize: 26 }} data-testid={`kpi-${x.label}`}>{x.value}</span>
            <span className={`sub ${x.tone ?? ''}`}>{x.sub}</span>
          </div>
        ))}
      </section>

      <div className="grid-2 stretch" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))' }}>
        <section aria-labelledby="ft-h" className="card pad col" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 id="ft-h" className="section-title">{copy("Focus time per day")}</h2>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{copy("Goal")} {fmtMinutes(goal)} {copy("· dashed line")}</span>
          </div>
          <div className="chart" role="img" aria-label={copy("Focus minutes per day over the last {0} days; total {1}", days, fmtMinutes(k.focusMin))} style={{ height: chartH, gap: range === '7d' ? 8 : 3 }} key={range}>
            <div className="goal" aria-hidden="true" style={{ bottom: Math.round((goal / maxBar) * chartH) }} />
            {k.focusPerDay.map((m, i) => {
              const d = addDays(k.from, i);
              const last = i === k.focusPerDay.length - 1;
              return (
                <div key={i} className={`c ${i < 2 ? 'edge-l' : i >= k.focusPerDay.length - 2 ? 'edge-r' : ''}`}>
                  <span className="tip">{fmt.dowMonthDay(d)} · {fmtMinutes(m)}</span>
                  <div className={`b ${m === 0 ? 'zero' : last ? 'last' : m >= goal ? 'hi' : ''}`} style={{ height: Math.max(3, Math.round((m / maxBar) * chartH)), animationDelay: `${Math.min(i, 30) * (range === '7d' ? 35 : 12)}ms` }} />
                </div>
              );
            })}
          </div>
          <div className="chart-labels" style={{ gap: range === '7d' ? 8 : 3 }} aria-hidden="true">
            {labels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
        </section>

        <section aria-labelledby="hm-h" className="card pad col" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 id="hm-h" className="section-title">{copy("Daily activity · 12 weeks")}</h2>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{streakDays ? copy("{0}-day streak", streakDays) : copy("No streak yet")}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div className="heat" role="img" aria-label={copy("Tasks completed per day over 12 weeks; {0} in total", heat.reduce((a, c) => a + c.count, 0))}>
              {heat.map((c, i) => (
                <span
                  key={i}
                  title={c.future ? '' : `${fmt.dowMonthDay(c.date)} · ${c.count} ${c.count === 1 ? copy("task") : copy("tasks")}`}
                  className={c.today ? 'today' : ''}
                  style={{ background: c.future ? 'transparent' : `var(--h${c.level})`, animationDelay: `${Math.floor(i / 7) * 25}ms` }}
                />
              ))}
            </div>
          </div>
          <div className="heat-legend" aria-hidden="true">
            <span>{copy("Less")}</span>
            {[0, 1, 2, 3, 4].map((l) => <i key={l} style={{ background: `var(--h${l})` }} />)}
            <span>{copy("More")}</span>
          </div>
        </section>
      </div>

      <section aria-labelledby="pp-h" className="card clip">
        <div className="card-head col" style={{ alignItems: 'flex-start', gap: 6 }}><h2 id="pp-h" className="section-title">{copy("Project progress & deadline risk")}</h2><p className="muted" style={{ fontSize: 12.5 }}>{copy("Progress counts completed tasks, regardless of their size. Forecasts use remaining estimates and a 7-day average of logged focus time; without history, your daily goal is shared across active projects. Forecasts are estimates, not guarantees.")}</p></div>
        {rows.length === 0 ? (
          <EmptyState icon="folder" title={copy("No projects yet")} body={copy("Progress and risk show up here once you add a project.")} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">{copy("Project")}</th>
                  <th scope="col" style={{ width: 220 }}>{copy("Tasks completed")}</th>
                  <th scope="col">{copy("Tasks")}</th>
                  <th scope="col">{copy("Focus")}</th>
                  <th scope="col">{copy("Deadline")}</th>
                  <th scope="col">{copy("Projected")}</th>
                  <th scope="col">{copy("Risk")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = s.stats.get(p.id)!;
                  const warn = st.risk === 'at_risk' || st.risk === 'overdue';
                  const projected = st.risk === 'done' ? (p.completedAt ? fmt.monthDay(new Date(p.completedAt)) : copy("Done")) : st.remainingMin === 0 ? copy("Today") : dayKey(st.projectedFinish) === dayKey(now) ? copy("Today") : fmt.monthDay(st.projectedFinish);
                  return (
                    <tr key={p.id}>
                      <td><Link to={`/projects/${p.id}`}><span className="dot" style={{ background: p.color }} />{p.name}</Link></td>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <ProgressBar pct={st.pct} color={p.color} height={6} label={copy("{0} progress", p.name)} />
                          <span className="tnum" style={{ width: 34, textAlign: 'right', color: 'var(--text)' }}>{st.pct}%</span>
                        </div>
                      </td>
                      <td className="tnum">{st.done} / {st.total}</td>
                      <td>{fmtMinutesPadded(st.focusMin)}</td>
                      <td>{fmt.monthDay(parseDay(p.dueDate))}</td>
                      <td style={warn ? { color: 'var(--warn-text)', fontWeight: 500 } : undefined}>{projected}</td>
                      <td><RiskPill risk={st.risk} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="rp-h" className="card clip">
        <div className="card-head">
          <div className="col" style={{ gap: 2 }}>
            <h2 id="rp-h" className="section-title">{copy("Replan unfinished tasks")}</h2>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {appliedView
                ? copy("Moved {0} {1}. Undo restores the previous schedule.", shownRows.length, shownRows.length === 1 ? copy("task") : copy("tasks"))
                : preview.length
                  ? copy("{0} {1} from earlier days didn’t get done. Here’s where they fit before their deadlines.", preview.length, preview.length === 1 ? copy("task") : copy("tasks"))
                  : copy("Nothing slipped. Unfinished tasks from earlier days show up here.")}
            </span>
          </div>
          <label className="row" style={{ gap: 10, fontSize: 13, cursor: 'pointer' }}>
            <Switch checked={data.settings.autoReplan} onChange={(v) => s.updateSettings({ autoReplan: v })} label={copy("Auto-replan after your workday or when you return")} />
            <span aria-hidden="true">{copy("Auto-replan after your workday or when you return")}</span>
          </label>
        </div>
        {shownRows.length === 0 ? (
          <EmptyState icon="check" title={copy("You’re all caught up")} body={copy("When a scheduled task slips past its day, you’ll be able to move it here in one click.")} />
        ) : (
          <ul className="task-list" style={{ padding: '4px 0' }}>
            {shownRows.map((r) => {
              const t = data.tasks.find((x) => x.id === r.taskId);
              if (!t) return null;
              const p = projectById.get(t.projectId);
              const from = r.from ? new Date(r.from) : null;
              const to = r.to ? new Date(r.to) : null;
              return (
                <li key={r.taskId} className="replan-row item-enter">
                  <span className="t">{t.title}</span>
                  <span className="p">{p?.name}</span>
                  <span className="from">{from ? fmtSlot(from, now, false) : copy("Unscheduled")}</span>
                  <Icon name="arrowRight" size={14} style={{ color: 'var(--muted)' }} />
                  <span className={`to ${appliedView ? 'applied' : to ? '' : 'none'}`}>{to ? fmtSlot(to, now) : s.stats.get(t.projectId)?.risk === 'overdue' ? copy("No free slot today") : copy("No slot before deadline")}</span>
                </li>
              );
            })}
          </ul>
        )}
        {(preview.length > 0 || appliedView) && (
          <div className="foot-bar">
            {appliedView ? (
              <button type="button" className="btn btn-secondary" onClick={() => { s.undoReplan(); setJustApplied(false); toast({ title: copy("Replan undone"), body: copy("Tasks are back in their previous slots.") }); }}>
                {copy("Undo replan")}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!preview.some((p) => p.to)}
                onClick={() => {
                  const n = s.applyReplan(preview);
                  setJustApplied(n > 0);
                  toast({ tone: 'ok', title: copy("Moved {0} {1}", n, n === 1 ? copy("task") : copy("tasks")) });
                }}
              >
                {copy("Apply replan")}
              </button>
            )}
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{appliedView ? copy("Applied {0} at {1}.", relDay(new Date(last!.at), now).toLowerCase(), fmt.time(new Date(last!.at))) : note}</span>
          </div>
        )}
      </section>
    </Page>
  );
}
