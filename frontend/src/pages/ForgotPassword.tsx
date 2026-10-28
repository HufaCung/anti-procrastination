import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthHeader } from './AuthLayout';
import { Icon } from '../components/Icon';
import { TextField, useDocumentTitle } from '../components/ui';
import { requestPasswordReset } from '../data/auth';
import { useStore } from '../store/AppStore';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const s = useStore();
  const [email, setEmail] = useState(s.user?.email ?? '');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const ref = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;
    const r = requestPasswordReset(email);
    if (!r.ok) {
      setErr(r.error!);
      ref.current?.focus();
      return;
    }
    setStatus('loading');
    window.setTimeout(() => setStatus('sent'), 600);
  };

  return (
    <div className="auth" style={{ flexDirection: 'column', padding: '24px clamp(16px, 4vw, 48px)' }}>
      <AuthHeader />
      <main id="main" className="auth-center">
        <div className="auth-card">
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock" size={22} />
          </span>
          {status !== 'sent' ? (
            <div className="col" style={{ gap: 22 }}>
              <div className="col" style={{ gap: 6 }}>
                <h1 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em' }}>Forgot your password?</h1>
                <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Enter the email you signed up with and we’ll send a link to reset it.</p>
              </div>
              <form onSubmit={submit} noValidate className="col" style={{ gap: 16 }}>
                <TextField label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} inputRef={ref} onChange={(v) => { setEmail(v); setErr(''); }} error={err} />
                <button type="submit" className={`btn btn-primary btn-lg btn-block ${status === 'loading' ? 'loading' : ''}`} disabled={status === 'loading'}>
                  {status === 'loading' && <span className="spinner" aria-hidden="true" />}
                  {status === 'loading' ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </div>
          ) : (
            <div role="status" className="col page-enter" style={{ gap: 14 }}>
              <h1 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em' }}>Check your inbox</h1>
              <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                We sent a reset link to <span style={{ color: 'var(--text)', fontWeight: 600, overflowWrap: 'anywhere' }}>{email.trim()}</span>. It expires in 30 minutes.
              </p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Demo mode: no email is actually sent.</p>
            </div>
          )}
          <Link to={s.user ? '/profile' : '/login'} className="btn btn-secondary btn-block" style={{ height: 42, borderRadius: 9 }}>
            <Icon name="arrowLeft" size={15} />
            {s.user ? 'Back to settings' : 'Back to log in'}
          </Link>
        </div>
      </main>
    </div>
  );
}
