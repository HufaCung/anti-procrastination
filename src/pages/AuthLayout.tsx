import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeIconButton } from '../components/ui';
import { useStore } from '../store/AppStore';

export function AuthHeader({ right }: { right?: ReactNode }) {
  const s = useStore();
  return (
    <header className="auth-head">
      <Link to="/" className="row" style={{ gap: 10, color: 'var(--text)', textDecoration: 'none' }} aria-label="Notion Toolkit home">
        <div className="logo lg" aria-hidden="true">N</div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Notion Toolkit</span>
      </Link>
      <div className="row" style={{ gap: 12 }}>
        {right}
        <ThemeIconButton theme={s.theme} onToggle={() => s.setTheme(s.theme === 'dark' ? 'light' : 'dark')} />
      </div>
    </header>
  );
}

export function AuthFooter() {
  return (
    <footer style={{ fontSize: 12, color: 'var(--muted)' }}>
      © {new Date().getFullYear()} Notion Toolkit · <a href="#privacy" style={{ color: 'var(--muted)' }} onClick={(e) => e.preventDefault()}>Privacy</a> ·{' '}
      <a href="#terms" style={{ color: 'var(--muted)' }} onClick={(e) => e.preventDefault()}>Terms</a>
    </footer>
  );
}
