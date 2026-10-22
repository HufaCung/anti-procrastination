import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import type { Risk, TaskStatus } from '../data/types';
import { STATUS_LABEL } from '../logic/status';
import { RISK_LABEL } from '../logic/progress';

export function ProgressBar({ pct, color, height = 5, label }: { pct: number; color?: string; height?: 5 | 6 | 8; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div
      className={`bar ${height === 6 ? 'h6' : height === 8 ? 'h8' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
    >
      <span style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function RiskPill({ risk, className = '' }: { risk: Risk; className?: string }) {
  return <span className={`pill ${risk} ${className}`}>{RISK_LABEL[risk]}</span>;
}

export function StatusButton({ status, title, onClick }: { status: TaskStatus; title: string; onClick: () => void }) {
  return (
    <button type="button" className={`pill ${status}`} onClick={onClick} aria-label={`Status ${STATUS_LABEL[status]}, change: ${title}`}>
      {STATUS_LABEL[status]}
    </button>
  );
}

export function CheckButton({ done, title, onClick }: { done: boolean; title: string; onClick: () => void }) {
  return (
    <button type="button" className={`cbox ${done ? 'on' : ''}`} onClick={onClick} aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${title}`} aria-pressed={done}>
      {done && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5 10 17 19 7" />
        </svg>
      )}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value, options, onChange, label, tall, full,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  tall?: boolean;
  full?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    let n = idx;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (idx - 1 + options.length) % options.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (idx + 1) % options.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = options.length - 1;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`seg ${tall ? 'tall' : ''} ${full ? 'full' : ''}`} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (idx === -1 && i === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function TextField({
  label, value, onChange, error, type = 'text', placeholder, autoComplete, id, hint, inputRef, large = true, autoFocus,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
  hint?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const gen = useId();
  const fid = id ?? gen;
  const errId = `${fid}-err`;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <input
        id={fid}
        ref={inputRef}
        className={`input ${large ? 'lg' : ''} ${error ? 'err' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint}
      {error && <span id={errId} role="alert" className="err-text">{error}</span>}
    </div>
  );
}

export function PasswordField({
  label, value, onChange, error, autoComplete, id, right, children, inputRef,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  id?: string;
  right?: ReactNode;
  children?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);
  const gen = useId();
  const fid = id ?? gen;
  const errId = `${fid}-err`;
  return (
    <div className="field">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <label htmlFor={fid}>{label}</label>
        {right}
      </div>
      <div className={`input-wrap ${error ? 'err' : ''}`}>
        <input
          id={fid}
          ref={inputRef}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          placeholder="At least 8 characters"
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
        </button>
      </div>
      {children}
      {error && <span id={errId} role="alert" className="err-text">{error}</span>}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, body, children }: { icon?: IconName; title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="ico"><Icon name={icon} size={20} /></span>
      <span className="t">{title}</span>
      {body && <span className="b">{body}</span>}
      {children && <div className="row wrap" style={{ justifyContent: 'center', marginTop: 4 }}>{children}</div>}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible modal: focus trap, Esc to close, restores focus, animated in and out. */
export function Modal({
  open, onClose, title, children, footer, labelledBy, width = 460, initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
  width?: number;
  initialFocus?: React.RefObject<HTMLElement>;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 140);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const node = ref.current;
      const target = initialFocus?.current ?? node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      const node = ref.current;
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      const r = restore.current;
      if (r && document.contains(r)) window.setTimeout(() => r.focus(), 0);
    };
  }, [open, initialFocus]);

  if (!mounted) return null;
  return createPortal(
    <div className={`overlay ${closing ? 'closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId} style={{ maxWidth: width }}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn plain" aria-label="Close dialog" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({
  open, onClose, onConfirm, title, body, confirmLabel = 'Delete', danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-autofocus>Cancel</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <div className="modal-body" style={{ color: 'var(--text2)', lineHeight: 1.5 }}>{body}</div>
    </Modal>
  );
}

export function ThemeIconButton({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="icon-btn" onClick={onToggle} aria-label={label} title={label}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  );
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Notion Toolkit` : 'Notion Toolkit';
  }, [title]);
}
