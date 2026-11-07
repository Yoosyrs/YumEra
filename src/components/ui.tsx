'use client';

import Link from 'next/link';
import { ReactNode, useEffect } from 'react';
import { initials } from '@/lib/client';

export function Avatar({
  src,
  name,
  size = 40,
  className = '',
}: {
  src?: string | null;
  name: string;
  size?: 32 | 40 | 56 | 88 | 120;
  className?: string;
}) {
  return (
    <span className={`avatar avatar-${size} ${className}`} aria-hidden={false}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`card ${pad ? 'card-pad' : ''} ${className}`}>{children}</div>;
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 26, marginBottom: 8 }}>✦</div>
      <strong>{title}</strong>
      {hint && <p className="tiny muted" style={{ marginTop: 6 }}>{hint}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="tiny muted-2">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; badge?: number }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          className={`chip ${value === tab.id ? 'chip-static active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {typeof tab.badge === 'number' && tab.badge > 0 ? ` · ${tab.badge}` : ''}
        </button>
      ))}
    </div>
  );
}

export function UserLink({ username, name, avatar, size = 40 }: { username: string; name: string; avatar?: string | null; size?: 32 | 40 | 56 | 88 }) {
  return (
    <Link href={`/u/${username}`} className="row" style={{ gap: 10, color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
      <Avatar src={avatar} name={name} size={size} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{name}</span>
        <span className="tiny muted">@{username}</span>
      </span>
    </Link>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center tiny muted" style={{ padding: 28 }}>
      <span className="spin">✦</span> {label}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'ok' | 'warn'; children: ReactNode }) {
  const cls = kind === 'ok' ? 'alert-ok' : kind === 'warn' ? 'alert-warn' : 'alert-error';
  return <div className={`alert ${cls}`}>{children}</div>;
}
