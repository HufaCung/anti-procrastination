import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Segmented, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import type { Priority } from '../data/types';
import { addDays, dayKey } from '../logic/dates';

const GOALS: [number, string, string][] = [[60, '1 hour', 'Light days'], [120, '2 hours', 'Recommended'], [180, '3 hours', 'Exam season'], [240, '4 hours', 'Full sprint']];

export function OnboardingPage() {
  useDocumentTitle('Set up');
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState(120);
  const [size, setSize] = useState<10 | 15>(15);
  const [project, setProject] = useState('');
  const [due, setDue] = useState(dayKey(addDays(new Date(), 21)));
  const [prio, setPrio] = useState<Priority>('high');
  const [desc, setDesc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);


  const go = (n: number) => {
    setStep(n);
    window.setTimeout(() => headingRef.current?.focus(), 30);
  };

  const finish = () => {
    if (busy) return;
    const errs: Record<string, string> = {};
    if (project.trim().length < 2) errs.name = 'Give your project a name (2+ characters).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) errs.due = 'Pick a deadline.';
    else if (due < dayKey(new Date())) errs.due = 'The deadline can’t be in the past.';
    setErrors(errs);
    if (errs.name) return nameRef.current?.focus();
    if (errs.due) return document.getElementById('ob-due')?.focus();
    setBusy(true);
    s.updateSettings({ dailyGoalMin: goal, defaultTaskMin: size });
    const p = s.createProject({ name: project, dueDate: due, priority: prio, description: desc });
    s.markOnboarded();
    toast({ tone: 'ok', title: `Created ${p.name}`, body: 'Add a few 10–15 minute tasks to get started.' });
    navigate(`/projects/${p.id}`, { replace: true });
  };

  const skip = () => {
    s.updateSettings({ dailyGoalMin: goal, defaultTaskMin: size });
    s.markOnboarded();
    navigate('/', { replace: true });
  };

  const stepsAria = `Step ${step} of 2`;
  return (
    <div className="auth" style={{ flexDirection: 'column', padding: '24px clamp(16px, 4vw, 48px)' }}>
      <header className="auth-head">
        <div className="row" style={{ gap: 10 }}>
          <div className="logo lg" aria-hidden="true">T</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>TinyDo</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>Skip for now</button>
      </header>

      <main id="main" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="steps" role="progressbar" aria-label={stepsAria} aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}>
            {[1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
          </div>

          {step === 1 && (
            <section className="col page-enter" style={{ gap: 20 }} key="s1">
              <div className="col" style={{ gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Step 1 of 2</span>
                <h1 ref={headingRef} tabIndex={-1} className="page-title">How much focus time per day?</h1>
                <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>We use this to check whether your deadlines are realistic. You can change it later in Profile.</p>
              </div>
              <GoalPicker value={goal} onChange={setGoal} />
              <div className="col" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Default task size</span>
                <div style={{ alignSelf: 'flex-start' }}>
                  <Segmented label="Default task size" tall value={size} onChange={setSize} options={[{ value: 10, label: '10 min' }, { value: 15, label: '15 min' }]} />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="col page-enter" style={{ gap: 20 }} key="s2">
              <div className="col" style={{ gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Step 2 of 2</span>
                <h1 ref={headingRef} tabIndex={-1} className="page-title">What’s your first project?</h1>
                <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Something with a deadline works best. You can skip this and add projects later.</p>
              </div>
              <div className="field">
                <label htmlFor="ob-name">Project name</label>
                <input id="ob-name" ref={nameRef} className={`input lg ${errors.name ? 'err' : ''}`} value={project} onChange={(e) => { setProject(e.target.value); setErrors((x) => ({ ...x, name: '' })); }} placeholder="e.g. Final report for Data Structures" aria-invalid={!!errors.name} />
                {errors.name && <span role="alert" className="err-text">{errors.name}</span>}
              </div>
              <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="field" style={{ flex: '1 1 200px' }}>
                  <label htmlFor="ob-due">Deadline</label>
                  <input id="ob-due" type="date" className={`input lg ${errors.due ? 'err' : ''}`} value={due} min={dayKey(new Date())} onChange={(e) => { setDue(e.target.value); setErrors((x) => ({ ...x, due: '' })); }} aria-invalid={!!errors.due} />
                  {errors.due && <span role="alert" className="err-text">{errors.due}</span>}
                </div>
                <div className="field" style={{ flex: '1 1 200px' }}>
                  <span className="field-label">Priority</span>
                  <Segmented label="Priority" full tall value={prio} onChange={setPrio} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="ob-desc">Notes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                <textarea id="ob-desc" rows={3} className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Research, write 3 sections, make slides…" />
              </div>
            </section>
          )}

          <div className="row" style={{ justifyContent: 'space-between', paddingTop: 4 }}>
            <button type="button" className="btn btn-secondary btn-lg" style={{ visibility: step === 1 ? 'hidden' : 'visible', fontWeight: 500 }} onClick={() => go(Math.max(1, step - 1))}>Back</button>
            {step === 1 ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => go(2)}>Continue</button>
            ) : (
              <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-lg" style={{ fontWeight: 500 }} onClick={skip}>Skip</button>
                <button type="button" className={`btn btn-primary btn-lg ${busy ? 'loading' : ''}`} onClick={finish} disabled={busy}>Create project</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function GoalPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = GOALS.findIndex(([v]) => v === value);
  const onKey = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (idx + dir + GOALS.length) % GOALS.length;
    onChange(GOALS[n][0]);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Daily focus goal" onKeyDown={onKey} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 10 }}>
      {GOALS.map(([v, l, h], i) => (
        <button key={v} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1} className="goal-opt" onClick={() => onChange(v)}>
          <span style={{ fontSize: 18, fontWeight: 650 }}>{l}</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{h}</span>
        </button>
      ))}
    </div>
  );
}
