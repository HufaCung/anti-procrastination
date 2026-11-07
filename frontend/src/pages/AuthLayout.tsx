import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemeIconButton } from '../components/ui';
import { useStore } from '../store/AppStore';
import { LanguageToggle, useLanguage } from '../i18n/LanguageContext';

export function AuthHeader({ right }: { right?: ReactNode }) {
  const s = useStore();
  const { t } = useLanguage();
  return (
    <header className="auth-head">
      <Link to="/" className="row" style={{ gap: 10, color: 'var(--text)', textDecoration: 'none' }} aria-label={t('home')}>
        <div className="logo lg" aria-hidden="true">T</div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>TinyDo</span>
      </Link>
      <div className="row" style={{ gap: 12 }}>
        {right}
        <LanguageToggle compact />
        <ThemeIconButton theme={s.theme} onToggle={() => s.setTheme(s.theme === 'dark' ? 'light' : 'dark')} />
      </div>
    </header>
  );
}

export function AuthFooter() {
  return (
    <footer style={{ fontSize: 12, color: 'var(--muted)' }}>
      © {new Date().getFullYear()} TinyDo
    </footer>
  );
}
