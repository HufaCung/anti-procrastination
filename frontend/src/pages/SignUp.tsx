import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthFooter, AuthHeader } from './AuthLayout';
import { PasswordField, TextField, useDocumentTitle } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store/AppStore';
import { passwordScore } from '../data/auth';

const LABELS = ['Use 8+ characters with a mix of letters, numbers and symbols.', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['var(--track)', 'var(--danger-text)', '#E07B00', 'var(--accent)', 'var(--ok-strong)'];

export function SignUpPage() {
  useDocumentTitle('Create account');
  const s = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), agree: useRef<HTMLInputElement>(null) };
  const score = passwordScore(pw);
  const loc = useLocation();
  const [deleted] = useState(() => {
    try {
      const v = sessionStorage.getItem('nt-after-delete') === '1' || !!(loc.state as { deleted?: boolean } | null)?.deleted;
      sessionStorage.removeItem('nt-after-delete');
      return v;
    } catch {
      return false;
    }
  });

  const clear = (k: string) => setErrors((e) => {
    const n = { ...e };
    delete n[k];
    return n;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const r = await s.signUp({ name, email, password: pw, agree });
    if (!r.ok) {
      setLoading(false);
      setErrors(r.errors);
      const first = (['name', 'email', 'password', 'agree'] as const).find((k) => r.errors[k]);
      if (first) refs[first].current?.focus();
    }
  };

  return (
    <div className="auth">
      <main className="auth-main">
        <AuthHeader right={<span style={{ fontSize: 13, color: 'var(--muted)' }} className="hide-xs">Have an account? <Link to="/login" style={{ fontWeight: 600, textDecoration: 'none' }}>Log in</Link></span>} />
        <div className="auth-center">
          <div className="auth-form page-enter">
            <div className="col" style={{ gap: 6 }}>
              <h1>Create your workspace</h1>
              <p className="lead">Free for personal use. Set up takes about a minute.</p>
            </div>
            {deleted && <div role="status" className="status-ok">Your account and its data were deleted.</div>}
            <form onSubmit={submit} noValidate className="col" style={{ gap: 16 }}>
              {errors.form && <div role="alert" className="status-bad">{errors.form}</div>}
              <TextField label="Full name" autoComplete="name" placeholder="Nguyen Van A" value={name} inputRef={refs.name} onChange={(v) => { setName(v); clear('name'); }} error={errors.name} />
              <TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} inputRef={refs.email} onChange={(v) => { setEmail(v); clear('email'); }} error={errors.email} />
              <PasswordField label="Password" autoComplete="new-password" value={pw} inputRef={refs.password} onChange={(v) => { setPw(v); clear('password'); }} error={errors.password}>
                <div className="meter" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => <span key={i} style={{ background: pw && i < score ? COLORS[score] : undefined }} />)}
                </div>
                <span style={{ fontSize: 12.5, color: pw && score > 0 ? 'var(--text2)' : 'var(--muted)', fontWeight: pw && score > 0 ? 500 : 400 }} aria-live="polite">
                  {pw ? `Password strength: ${LABELS[score] === LABELS[0] ? 'Weak' : LABELS[score]}` : LABELS[0]}
                </span>
              </PasswordField>
              <div className="col" style={{ gap: 6 }}>
                <label className="check" style={{ alignItems: 'flex-start', lineHeight: 1.45 }}>
                  <input ref={refs.agree} type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); clear('agree'); }} style={{ marginTop: 2 }} aria-invalid={!!errors.agree} />
                  <span>I agree to the Terms and Privacy Policy.</span>
                </label>
                {errors.agree && <span role="alert" className="err-text">{errors.agree}</span>}
              </div>
              <button type="submit" className={`btn btn-primary btn-lg btn-block ${loading ? 'loading' : ''}`} disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Already have an account? <Link to="/login" style={{ fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
            </p>
          </div>
        </div>
        <AuthFooter />
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="inner" style={{ gap: 22, maxWidth: 440 }}>
          <p className="quote">Everything you need to finish on time.</p>
          <Feature icon="calendar" title="Deadline Manager" body="Priorities, a calendar and warnings before anything slips." />
          <Feature icon="focus" title="Focus Mode" body="Work through 10–15 minute tasks with a timer that keeps your place." />
          <Feature icon="chart" title="Progress Tracker" body="See focus time and deadline risk, and replan unfinished work automatically." />
        </div>
      </aside>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: 'calendar' | 'focus' | 'chart'; title: string; body: string }) {
  return (
    <div className="feature">
      <span className="ico"><Icon name={icon} size={18} /></span>
      <div className="col" style={{ gap: 3 }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <span style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{body}</span>
      </div>
    </div>
  );
}
