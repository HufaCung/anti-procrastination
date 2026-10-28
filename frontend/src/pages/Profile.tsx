import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Sidebar';
import { ConfirmModal, Modal, PasswordField, Segmented, Switch, TextField, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { changePassword, updateProfile } from '../data/auth';
import { daysBetween, fmt, fmtMinutes } from '../logic/dates';
import type { Settings } from '../data/types';

export function ProfilePage() {
  useDocumentTitle('Profile & settings');
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const user = s.user!;
  const settings = s.data!.settings;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [weekStart, setWeekStart] = useState(settings.weekStart);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user.name, user.email]);

  const dirty = name !== user.name || email !== user.email || weekStart !== settings.weekStart;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await updateProfile(user.id, { name, email });
    if (!r.ok) {
      setErrors(r.errors ?? {});
      return;
    }
    s.updateSettings({ weekStart });
    s.refreshUser();
    setErrors({});
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpe?g)$/.test(f.type)) {
      toast({ tone: 'warn', title: 'Use a PNG or JPG image' });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast({ tone: 'warn', title: 'That image is over 2 MB', body: 'Pick a smaller one.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      // Downscale to keep localStorage small.
      const img = new Image();
      img.onload = async () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        await updateProfile(user.id, { avatar: canvas.toDataURL('image/jpeg', 0.85) });
        s.refreshUser();
        toast({ tone: 'ok', title: 'Photo updated' });
      };
      img.onerror = () => toast({ tone: 'warn', title: 'Couldn’t read that image' });
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const exportData = () => {
    const d = s.data!;
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'TinyDo',
      version: 1,
      user: { name: user.name, email: user.email, createdAt: user.createdAt },
      settings: d.settings,
      projects: d.projects,
      tasks: d.tasks,
      focusSessions: d.sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tinydo-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ tone: 'ok', title: 'Export downloaded', body: `${d.projects.length} projects, ${d.tasks.length} tasks, ${d.sessions.length} sessions.` });
  };

  const setFlag = (k: keyof Settings, v: boolean) => {
    s.updateSettings({ [k]: v } as Partial<Settings>);
    if (k === 'deadlineAlerts' && v && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const pwAge = user.passwordChangedAt ? daysBetween(new Date(user.passwordChangedAt), s.now) : null;
  const pwLabel = pwAge == null ? 'Set when you signed up.' : pwAge === 0 ? 'Last changed today.' : `Last changed ${pwAge} ${pwAge === 1 ? 'day' : 'days'} ago.`;

  const toggles: [keyof Settings, string, string][] = [
    ['autoReplan', 'Auto-replan unfinished tasks', 'Every night at 22:00, move leftovers into free slots.'],
    ['deadlineAlerts', 'Deadline alerts', 'Warn 3 days, 1 day and 2 hours before a deadline.'],
    ['focusSound', 'Focus Mode end sound', 'Play a soft chime when a session ends.'],
  ];

  return (
    <Page label="Profile and settings" narrow>
      <header className="col" style={{ gap: 4 }}>
        <h1 className="page-title">Profile &amp; settings</h1>
        <span className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>Manage your account, focus preferences and notifications.</span>
      </header>

      <section aria-labelledby="pf-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="pf-h" className="section-title">Profile</h2></div>
        <form onSubmit={save} noValidate className="col" style={{ padding: 20, gap: 18 }}>
          <div className="row wrap" style={{ gap: 16 }}>
            <Avatar size="xl" />
            <div className="col" style={{ gap: 6 }}>
              <div className="row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={14} />
                  Upload photo
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onFile} />
                {user.avatar && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await updateProfile(user.id, { avatar: null }); s.refreshUser(); }}>Remove</button>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>PNG or JPG, up to 2 MB.</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
            <TextField id="pf-name" label="Full name" value={name} large={false} onChange={(v) => { setName(v); setSaved(false); setErrors((x) => ({ ...x, name: '' })); }} error={errors.name || undefined} autoComplete="name" />
            <TextField id="pf-email" label="Email" type="email" value={email} large={false} onChange={(v) => { setEmail(v); setSaved(false); setErrors((x) => ({ ...x, email: '' })); }} error={errors.email || undefined} autoComplete="email" />
            <div className="field">
              <label htmlFor="pf-ws">Week starts on</label>
              <select id="pf-ws" className="select" value={weekStart} onChange={(e) => { setWeekStart(e.target.value as 'mon' | 'sun'); setSaved(false); }}>
                <option value="mon">Monday</option>
                <option value="sun">Sunday</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={!dirty}>Save changes</button>
            {saved && <span role="status" className="saved-note">Saved</span>}
          </div>
        </form>
      </section>

      <section aria-labelledby="fp-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="fp-h" className="section-title">Focus &amp; planning</h2></div>
        <div className="col">
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">Appearance</span><span className="h">Applies to every screen, including Focus Mode.</span></div>
            <Segmented label="Appearance" value={s.theme} onChange={(t) => s.setTheme(t)} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">Daily focus goal</span><span className="h">Used for deadline risk and replanning.</span></div>
            <div className="stepper">
              <button type="button" aria-label="Decrease goal" disabled={settings.dailyGoalMin <= 30} onClick={() => s.updateSettings({ dailyGoalMin: Math.max(30, settings.dailyGoalMin - 30) })}>−</button>
              <span className="v" aria-live="polite" data-testid="goal">{fmtMinutes(settings.dailyGoalMin)} / day</span>
              <button type="button" aria-label="Increase goal" disabled={settings.dailyGoalMin >= 480} onClick={() => s.updateSettings({ dailyGoalMin: Math.min(480, settings.dailyGoalMin + 30) })}>+</button>
            </div>
          </div>
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">Default task size</span><span className="h">Pre-selected estimate when you add a task.</span></div>
            <Segmented label="Default task size" value={settings.defaultTaskMin} onChange={(v) => s.updateSettings({ defaultTaskMin: v })} options={[{ value: 10 as const, label: '10 min' }, { value: 15 as const, label: '15 min' }]} />
          </div>
          {toggles.map(([k, label, hint]) => (
            <div key={k} className="set-row" style={{ flexWrap: 'nowrap' }}>
              <div className="col" style={{ gap: 2, minWidth: 0 }}><span className="k">{label}</span><span className="h">{hint}</span></div>
              <Switch checked={!!settings[k]} onChange={(v) => setFlag(k, v)} label={label} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ac-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="ac-h" className="section-title">Account</h2></div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}><span className="k">Password</span><span className="h">{pwLabel}</span></div>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => setPwOpen(true)}>Change password</button>
        </div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}><span className="k">Export data</span><span className="h">Projects, tasks and focus sessions as JSON.</span></div>
          <button type="button" className="btn btn-secondary btn-md" onClick={exportData}>
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}><span className="k">Log out</span><span className="h">Member since {fmt.monthDay(new Date(user.createdAt))}, {new Date(user.createdAt).getFullYear()}.</span></div>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => { s.logOut(); navigate('/login'); }}>
            <Icon name="logout" size={15} />
            Log out
          </button>
        </div>
        <div className="set-row danger">
          <div className="col" style={{ gap: 2 }}><span className="k">Delete account</span><span className="h">Permanently removes your workspace and all data.</span></div>
          <button type="button" className="btn btn-danger-outline btn-md" onClick={() => setConfirmDelete(true)}>Delete account</button>
        </div>
      </section>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        body={<>This permanently removes <strong>{user.email}</strong>, {s.data!.projects.length} projects, {s.data!.tasks.length} tasks and all focus history from this browser. This can’t be undone.</>}
        confirmLabel="Delete account"
        onConfirm={() => {
          setConfirmDelete(false);
          s.deleteAccount();
        }}
      />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Page>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState<{ cur?: string; next?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setCur('');
      setNext('');
      setErr({});
    }
  }, [open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setErr({ next: 'Password must be at least 8 characters.' });
    setBusy(true);
    const r = await changePassword(s.user!.id, cur, next);
    setBusy(false);
    if (!r.ok) return setErr(r.error?.startsWith('Current') ? { cur: r.error } : { next: r.error });
    s.refreshUser();
    onClose();
    toast({ tone: 'ok', title: 'Password changed' });
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <PasswordField label="Current password" autoComplete="current-password" value={cur} onChange={(v) => { setCur(v); setErr({}); }} error={err.cur} />
          <PasswordField label="New password" autoComplete="new-password" value={next} onChange={(v) => { setNext(v); setErr({}); }} error={err.next} />
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Forgot it? <Link to="/forgot-password">Reset by email</Link>.</span>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Update password</button>
        </div>
      </form>
    </Modal>
  );
}
