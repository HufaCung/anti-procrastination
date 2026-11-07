import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthFooter, AuthHeader } from './AuthLayout';
import { PasswordField, TextField, useDocumentTitle } from '../components/ui';
import { Icon } from '../components/Icon';
import { useStore } from '../store/AppStore';
import { passwordScore } from '../data/auth';
import { useLanguage } from '../i18n/LanguageContext';

const COLORS = ['var(--track)', 'var(--danger-text)', '#E07B00', 'var(--accent)', 'var(--ok-strong)'];

export function SignUpPage() {
  const { t } = useLanguage();
  useDocumentTitle(t('createTitle'));
  const s = useStore();
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const refs = { username: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null), confirmPassword: useRef<HTMLInputElement>(null) };
  const score = passwordScore(pw);
  const clear = (k: string) => setErrors((e) => {
    const n = { ...e };
    delete n[k];
    return n;
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const r = await s.signUp({ username, password: pw, confirmPassword });
    if (!r.ok) {
      setLoading(false);
      setErrors(r.errors);
      const first = (['username', 'password', 'confirmPassword'] as const).find((k) => r.errors[k]);
      if (first) refs[first].current?.focus();
    }
  };

  return (
    <div className="auth">
      <main className="auth-main">
        <AuthHeader right={<span style={{ fontSize: 13, color: 'var(--muted)' }} className="hide-xs">{t('haveAccount')} <Link to="/login" style={{ fontWeight: 600, textDecoration: 'none' }}>{t('login')}</Link></span>} />
        <div className="auth-center">
          <div className="auth-form page-enter">
            <div className="col" style={{ gap: 6 }}>
              <h1>{t('createWorkspace')}</h1>
              <p className="lead">{t('createLead')}</p>
            </div>
            <form onSubmit={submit} noValidate className="col" style={{ gap: 16 }}>
              {errors.form && <div role="alert" className="status-bad">{errors.form}</div>}
              <TextField label={t('username')} autoComplete="username" placeholder={t('yourUsername')} value={username} inputRef={refs.username} onChange={(v) => { setUsername(v); clear('username'); clear('form'); }} error={errors.username} />
              <PasswordField label={t('password')} autoComplete="new-password" value={pw} inputRef={refs.password} onChange={(v) => { setPw(v); clear('password'); }} error={errors.password}>
                <div className="meter" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => <span key={i} style={{ background: pw && i < score ? COLORS[score] : undefined }} />)}
                </div>
                <span style={{ fontSize: 12.5, color: pw && score > 0 ? 'var(--text2)' : 'var(--muted)', fontWeight: pw && score > 0 ? 500 : 400 }} aria-live="polite">
                  {pw ? `${t('passwordStrength')}: ${[t('passwordHint'), t('weak'), t('fair'), t('good'), t('strong')][score] === t('passwordHint') ? t('weak') : [t('passwordHint'), t('weak'), t('fair'), t('good'), t('strong')][score]}` : t('passwordHint')}
                </span>
              </PasswordField>
              <PasswordField label={t('confirmPassword')} autoComplete="new-password" value={confirmPassword} inputRef={refs.confirmPassword} onChange={(v) => { setConfirmPassword(v); clear('confirmPassword'); }} error={errors.confirmPassword} />
              <button type="submit" className={`btn btn-primary btn-lg btn-block ${loading ? 'loading' : ''}`} disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? t('creatingAccount') : t('createAccount')}
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              {t('alreadyAccount')} <Link to="/login" style={{ fontWeight: 600, textDecoration: 'none' }}>{t('login')}</Link>
            </p>
          </div>
        </div>
        <AuthFooter />
      </main>
      <aside className="auth-aside" aria-hidden="true">
        <div className="inner" style={{ gap: 22, maxWidth: 440 }}>
          <p className="quote">{t('finishOnTime')}</p>
          <Feature icon="calendar" title={t('deadlineManager')} body={t('deadlineBody')} />
          <Feature icon="focus" title={t('focusMode')} body={t('focusBody')} />
          <Feature icon="chart" title={t('progressTracker')} body={t('progressBody')} />
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
