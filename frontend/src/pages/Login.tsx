import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthFooter, AuthHeader } from './AuthLayout';
import { PasswordField, TextField, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { Icon } from '../components/Icon';

export function LoginPage() {
  useDocumentTitle('Log in');
  const s = useStore();
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const r = await s.logIn({ username, password: pw, remember: true });
    if (!r.ok) {
      setLoading(false);
      setErrors(r.errors);
      if (r.errors.username) usernameRef.current?.focus();
      else if (r.errors.password || r.errors.form) pwRef.current?.focus();
    }
    // On success the route guard redirects.
  };

  return (
    <div className="auth">
      <main className="auth-main">
        <AuthHeader />
        <div className="auth-center">
          <div className="auth-form page-enter">
            <div className="col" style={{ gap: 6 }}>
              <h1>Welcome back</h1>
              <p className="lead">Log in to pick up where you left off.</p>
            </div>
            <form onSubmit={submit} noValidate className="col" style={{ gap: 16 }}>
              {errors.form && <div role="alert" className="status-bad">{errors.form}</div>}
              <TextField
                label="Username" autoComplete="username" placeholder="Your username" value={username} inputRef={usernameRef}
                onChange={(v) => { setUsername(v); setErrors(({ username: _e, form: _f, ...rest }) => rest); }}
                error={errors.username}
              />
              <PasswordField
                label="Password" autoComplete="current-password" value={pw} inputRef={pwRef}
                onChange={(v) => { setPw(v); setErrors(({ password: _p, form: _f, ...rest }) => rest); }}
                error={errors.password}
              />
              <button type="submit" className={`btn btn-primary btn-lg btn-block ${loading ? 'loading' : ''}`} disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
            <div className="divider-label">NEW HERE?</div>
            <Link to="/signup" className="btn btn-secondary btn-lg btn-block">Create an account</Link>
          </div>
        </div>
        <AuthFooter />
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="inner" style={{ gap: 22, maxWidth: 440 }}>
          <p className="quote">Big deadlines, broken into 15-minute steps you can actually start.</p>
          <Feature icon="calendar" title="See what’s due" body="Deadlines, risk and a calendar of your planned sessions in one place." />
          <Feature icon="chart" title="Start small" body="Split each project into 10–15 minute tasks and watch progress add up." />
          <Feature icon="focus" title="Stay with it" body="Focus Mode times each task and logs your progress." />
        </div>
      </aside>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: 'calendar' | 'chart' | 'focus'; title: string; body: string }) {
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
