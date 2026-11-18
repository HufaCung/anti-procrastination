import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthFooter, AuthHeader } from './AuthLayout';
import { PasswordField, TextField, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { Icon } from '../components/Icon';
import { translateCopy } from '../i18n/copy';
import { useLanguage } from '../i18n/LanguageContext';

export function LoginPage() {
  const { t, language } = useLanguage();
  const errorText = (value: string | undefined) => value && translateCopy(language, value);
  useDocumentTitle(t('loginTitle'));
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
              <h1>{t('welcomeBack')}</h1>
              <p className="lead">{t('loginLead')}</p>
            </div>
            <form onSubmit={submit} noValidate className="col" style={{ gap: 16 }}>
              {errors.form && <div role="alert" className="status-bad">{errorText(errors.form)}</div>}
              <TextField
                label={t('username')} autoComplete="username" placeholder={t('yourUsername')} value={username} inputRef={usernameRef}
                onChange={(v) => { setUsername(v); setErrors(({ username: _e, form: _f, ...rest }) => rest); }}
                error={errorText(errors.username)}
              />
              <PasswordField
                label={t('password')} autoComplete="current-password" value={pw} inputRef={pwRef}
                onChange={(v) => { setPw(v); setErrors(({ password: _p, form: _f, ...rest }) => rest); }}
                error={errorText(errors.password)}
              />
              <button type="submit" className={`btn btn-primary btn-lg btn-block ${loading ? 'loading' : ''}`} disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? t('loggingIn') : t('login')}
              </button>
            </form>
            <div className="divider-label">{t('newHere')}</div>
            <Link to="/signup" className="btn btn-secondary btn-lg btn-block">{t('createAccount')}</Link>
          </div>
        </div>
        <AuthFooter />
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="inner" style={{ gap: 22, maxWidth: 440 }}>
          <p className="quote">{t('loginQuote')}</p>
          <Feature icon="calendar" title={t('seeDue')} body={t('seeDueBody')} />
          <Feature icon="chart" title={t('startSmall')} body={t('startSmallBody')} />
          <Feature icon="focus" title={t('stayWithIt')} body={t('stayWithItBody')} />
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
