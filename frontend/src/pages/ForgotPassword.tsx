import { Link } from 'react-router-dom';
import { AuthHeader } from './AuthLayout';
import { Icon } from '../components/Icon';
import { useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const { user } = useStore();
  return (
    <div className="auth" style={{ flexDirection: 'column', padding: '24px clamp(16px, 4vw, 48px)' }}>
      <AuthHeader />
      <main id="main" className="auth-center">
        <div className="auth-card">
          <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={22} /></span>
          <div className="col" style={{ gap: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em' }}>Forgot your password?</h1>
            <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Password reset by email is not available yet. If you are signed in, you can change your password in settings.</p>
          </div>
          <Link to={user ? '/profile' : '/login'} className="btn btn-secondary btn-block" style={{ height: 42, borderRadius: 9 }}>
            <Icon name="arrowLeft" size={15} />
            {user ? 'Back to settings' : 'Back to log in'}
          </Link>
        </div>
      </main>
    </div>
  );
}
