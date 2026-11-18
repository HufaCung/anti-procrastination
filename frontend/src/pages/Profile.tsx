import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Sidebar';
import { Modal, PasswordField, Segmented, Switch, TextField, useDocumentTitle } from '../components/ui';
import { useStore } from '../store/AppStore';
import { useToast } from '../store/toast';
import { changePassword, updateProfile } from '../data/auth';
import { daysBetween } from '../logic/dates';
import type { Settings } from '../data/types';
import { translateCopy } from '../i18n/copy';
import { useDateCopy, useCopy, LanguageToggle, useLanguage } from '../i18n/LanguageContext';

export function ProfilePage() {
  const { fmtMinutes, fmt } = useDateCopy();
  const copy = useCopy();
  const { t, language } = useLanguage();
  const vi = language === 'vi';
  useDocumentTitle(t('profileSettings'));
  const s = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const user = s.user!;
  const settings = s.data!.settings;
  const [name, setName] = useState(user.name);
  const [weekStart, setWeekStart] = useState(settings.weekStart);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const dirty = name !== user.name || weekStart !== settings.weekStart;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await updateProfile(user.id, { name });
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
      toast({ tone: 'warn', title: copy("Use a PNG or JPG image") });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast({ tone: 'warn', title: copy("That image is over 2 MB"), body: copy("Pick a smaller one.") });
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
        toast({ tone: 'ok', title: copy("Photo updated") });
      };
      img.onerror = () => toast({ tone: 'warn', title: copy("Couldn’t read that image") });
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const setFlag = (k: keyof Settings, v: boolean) => {
    s.updateSettings({ [k]: v } as Partial<Settings>);
    if (k === 'deadlineAlerts' && v && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const pwAge = user.passwordChangedAt ? daysBetween(new Date(user.passwordChangedAt), s.now) : null;
  const pwLabel = pwAge == null ? copy("Set when you signed up.") : pwAge === 0 ? copy("Last changed today.") : copy("Last changed {0} {1} ago.", pwAge, pwAge === 1 ? copy("day") : copy("days"));

  const toggles: [keyof Settings, string, string][] = [
    ['autoReplan', copy("Auto-replan unfinished tasks"), copy("Move unfinished tasks after your workday ends or when you return. Uses this device’s local time.")],
    ['deadlineAlerts', copy("Deadline alerts"), copy("Warn 3 days, 1 day and 2 hours before a deadline.")],
    ['focusSound', copy("Focus Mode end sound"), copy("Play a soft chime when a session ends.")],
  ];

  return (
    <Page label={copy("Profile and settings")} narrow>
      <header className="col" style={{ gap: 4 }}>
        <h1 className="page-title">{t('profileSettings')}</h1>
        <span className="meta" style={{ fontSize: 13, color: 'var(--muted)' }}>{copy("Manage your account, focus preferences and notifications.")}</span>
      </header>

      <section aria-labelledby="pf-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="pf-h" className="section-title">{copy("Profile")}</h2></div>
        <form onSubmit={save} noValidate className="col" style={{ padding: 20, gap: 18 }}>
          <div className="row wrap" style={{ gap: 16 }}>
            <Avatar size="xl" />
            <div className="col" style={{ gap: 6 }}>
              <div className="row">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={14} />
                  {copy("Upload photo")}
                </button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onFile} />
                {user.avatar && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await updateProfile(user.id, { avatar: null }); s.refreshUser(); }}>{copy("Remove")}</button>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{copy("PNG or JPG, up to 2 MB.")}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
            <TextField id="pf-name" label={copy("Display name")} value={name} large={false} onChange={(v) => { setName(v); setSaved(false); setErrors((x) => ({ ...x, name: '' })); }} error={errors.name ? translateCopy(language, errors.name) : undefined} autoComplete="name" />
            <div className="field">
              <label htmlFor="pf-username">{copy("Username")}</label>
              <input id="pf-username" className="input" value={user.username} readOnly aria-describedby="pf-username-hint" />
              <span id="pf-username-hint" className="meta">{copy("Username cannot be changed.")}</span>
            </div>
            <div className="field">
              <label htmlFor="pf-ws">{copy("Week starts on")}</label>
              <select id="pf-ws" className="select" value={weekStart} onChange={(e) => { setWeekStart(e.target.value as 'mon' | 'sun'); setSaved(false); }}>
                <option value="mon">{copy("Monday")}</option>
                <option value="sun">{copy("Sunday")}</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            {errors.form && <span role="alert">{translateCopy(language, errors.form)}</span>}
            <button type="submit" className="btn btn-primary" disabled={!dirty}>{copy("Save changes")}</button>
            {saved && <span role="status" className="saved-note">{copy("Saved")}</span>}
          </div>
        </form>
      </section>

      <section aria-labelledby="fp-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="fp-h" className="section-title">{copy("Focus & planning")}</h2></div>
        <div className="col">
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">{t('appLanguage')}</span><span className="h">{t('appLanguageHint')}</span></div>
            <LanguageToggle />
          </div>
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">{copy("Appearance")}</span><span className="h">{copy("Applies to every screen, including Focus Mode.")}</span></div>
            <Segmented label={copy("Appearance")} value={s.theme} onChange={(t) => s.setTheme(t)} options={[{ value: 'light', label: copy("Light") }, { value: 'dark', label: copy("Dark") }]} />
          </div>
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">{copy("Daily focus goal")}</span><span className="h">{copy("Used for deadline risk and replanning.")}</span></div>
            <div className="stepper">
              <button type="button" aria-label={copy("Decrease goal")} disabled={settings.dailyGoalMin <= 30} onClick={() => s.updateSettings({ dailyGoalMin: Math.max(30, settings.dailyGoalMin - 30) })}>−</button>
              <span className="v" aria-live="polite" data-testid="goal">{fmtMinutes(settings.dailyGoalMin)}{copy(" / day")}</span>
              <button type="button" aria-label={copy("Increase goal")} disabled={settings.dailyGoalMin >= 480} onClick={() => s.updateSettings({ dailyGoalMin: Math.min(480, settings.dailyGoalMin + 30) })}>+</button>
            </div>
          </div>
          <div className="set-row">
            <div className="col" style={{ gap: 2 }}><span className="k">{copy("Default task size")}</span><span className="h">{copy("Pre-selected estimate when you add a task.")}</span></div>
            <Segmented label={copy("Default task size")} value={settings.defaultTaskMin} onChange={(v) => s.updateSettings({ defaultTaskMin: v })} options={[{ value: 10 as const, label: copy("{0} min", 10) }, { value: 15 as const, label: copy("{0} min", 15) }]} />
          </div>
          <WorkScheduleForm key={`${settings.workStartMin}-${settings.workEndMin}-${settings.daysOffMask}`} settings={settings} onSave={s.updateSettings} />
          {toggles.map(([k, label, hint]) => (
            <div key={k} className="set-row" style={{ flexWrap: 'nowrap' }}>
              <div className="col" style={{ gap: 2, minWidth: 0 }}><span className="k">{label}</span><span className="h">{hint}</span></div>
              <Switch checked={!!settings[k]} onChange={(v) => setFlag(k, v)} label={label} />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ac-h" className="card clip">
        <div className="card-head" style={{ padding: '14px 20px' }}><h2 id="ac-h" className="section-title">{copy("Account")}</h2></div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}><span className="k">{copy("Password")}</span><span className="h">{pwLabel}</span></div>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => setPwOpen(true)}>{copy("Change password")}</button>
        </div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}><span className="k">{copy("Log out")}</span><span className="h">{copy("Member since")} {fmt.monthDay(new Date(user.createdAt))}, {new Date(user.createdAt).getFullYear()}.</span></div>
          <button type="button" className="btn btn-secondary btn-md" onClick={() => { s.logOut(); navigate('/login'); }}>
            <Icon name="logout" size={15} />
            {copy("Log out")}
          </button>
        </div>
        <div className="set-row">
          <div className="col" style={{ gap: 2 }}>
            <span className="k">{vi ? 'Xóa tài khoản' : 'Delete account'}</span>
            <span className="h">{vi ? 'Xóa vĩnh viễn tài khoản và dữ liệu liên quan.' : 'Permanently remove your account and its data.'}</span>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
            {vi ? 'Xóa tài khoản' : 'Delete account'}
          </button>
        </div>
      </section>

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Page>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language } = useLanguage();
  const copy = useCopy();
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
    if (next.length < 8) return setErr({ next: copy("Password must be at least 8 characters.") });
    setBusy(true);
    const r = await changePassword(s.user!.id, cur, next);
    setBusy(false);
    if (!r.ok) return setErr(r.error?.startsWith('Current') ? { cur: r.error } : { next: r.error });
    s.refreshUser();
    onClose();
    toast({ tone: 'ok', title: copy("Password changed") });
  };
  return (
    <Modal open={open} onClose={onClose} title={copy("Change password")}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <PasswordField label={copy("Current password")} autoComplete="current-password" value={cur} onChange={(v) => { setCur(v); setErr({}); }} error={err.cur ? translateCopy(language, err.cur) : undefined} />
          <PasswordField label={copy("New password")} autoComplete="new-password" value={next} onChange={(v) => { setNext(v); setErr({}); }} error={err.next ? translateCopy(language, err.next) : undefined} />
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{copy("Password reset is unavailable.")}</span>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{copy("Cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{copy("Update password")}</button>
        </div>
      </form>
    </Modal>
  );
}

function timeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function minutesValue(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function WorkScheduleForm({ settings, onSave }: { settings: Settings; onSave: (value: Partial<Settings>) => void }) {
  const copy = useCopy();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const savedStart = timeValue(settings.workStartMin ?? 540);
  const savedEnd = timeValue(settings.workEndMin ?? 1320);
  const savedDays = settings.daysOffMask ?? 0;
  const [start, setStart] = useState(savedStart);
  const [end, setEnd] = useState(savedEnd);
  const [daysOff, setDaysOff] = useState(savedDays);
  const [error, setError] = useState('');
  const weekdays = vi
    ? ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
    : [copy("Sunday"), copy("Monday"), 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!start || !end || minutesValue(start) >= minutesValue(end)) {
      setError('hours');
      return;
    }
    if (daysOff === 127) {
      setError('days');
      return;
    }
    setError('');
    onSave({ workStartMin: minutesValue(start), workEndMin: minutesValue(end), daysOffMask: daysOff });
  }

  return (
    <form className="col" style={{ padding: 20, gap: 12 }} onSubmit={submit} noValidate>
      <h3 className="section-title">{vi ? 'Giờ làm việc' : 'Working hours'}</h3>
      <p className="meta">{vi ? 'Chỉ áp dụng khi tự động xếp lịch công việc mới hoặc xếp lại việc chưa hoàn thành. Lịch đã đặt được giữ nguyên.' : 'Used for automatic scheduling and replanning. Existing bookings stay in place.'}</p>
      <div className="row wrap" style={{ gap: 12 }}>
        <label className="field">{vi ? 'Bắt đầu' : 'Start time'}
          <input className="input" type="time" required value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="field">{vi ? 'Kết thúc' : 'End time'}
          <input className="input" type="time" required value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend>{vi ? 'Ngày nghỉ hằng tuần' : 'Weekly days off'}</legend>
        <div className="row wrap" style={{ gap: 12 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <label key={day} className="row" style={{ gap: 5 }}>
              <input type="checkbox" checked={Boolean(daysOff & (1 << day))} onChange={() => setDaysOff(daysOff ^ (1 << day))} />
              {weekdays[day]}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert">{error === 'hours'
        ? (vi ? 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.' : 'End time must be later than start time on the same day.')
        : (vi ? 'Hãy giữ ít nhất một ngày làm việc mỗi tuần.' : 'Keep at least one working day each week.')}</p>}
      <div><button type="submit" className="btn btn-primary" disabled={start === savedStart && end === savedEnd && daysOff === savedDays}>
        {vi ? 'Lưu lịch làm việc' : 'Save work schedule'}
      </button></div>
    </form>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const copy = useCopy();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const { deleteAccount } = useStore();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'password' | 'error'>('idle');
  const busy = status === 'busy';
  const title = vi ? 'Xóa tài khoản' : 'Delete account';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setStatus('busy');
    const result = await deleteAccount(password);
    if (result === 'deleted') navigate('/login', { replace: true });
    else setStatus(result);
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={title}>
      <form onSubmit={submit}>
        <div className="modal-body col" style={{ gap: 12 }}>
          <p>{vi
            ? 'Thao tác này xóa vĩnh viễn dự án, lịch sử tập trung, nhóm bạn sở hữu và các công việc nhóm do bạn tạo. Hãy nhập mật khẩu hiện tại để xác nhận.'
            : 'This permanently deletes your projects, focus history, teams you own, and shared tasks you created. Enter your current password to confirm.'}</p>
          <PasswordField label={vi ? 'Mật khẩu hiện tại' : copy("Current password")} autoComplete="current-password" value={password}
            onChange={(value) => { setPassword(value); if (!busy) setStatus('idle'); }}
            error={status === 'password' ? (vi ? 'Mật khẩu không đúng.' : 'Current password is incorrect.') : undefined} />
          {status === 'error' && <p role="alert">{vi ? 'Không thể xóa tài khoản. Hãy đăng nhập lại rồi thử lại.' : 'Could not delete your account. Sign in again and retry.'}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>{vi ? 'Hủy' : copy("Cancel")}</button>
          <button type="submit" className="btn btn-danger" disabled={busy || !password}>{busy ? (vi ? 'Đang xóa…' : 'Deleting…') : title}</button>
        </div>
      </form>
    </Modal>
  );
}
