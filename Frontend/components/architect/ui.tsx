'use client';

// Shared UI primitives for the architect dashboard (Stitch design system).
// Keeps the 20+ module pages consistent, accessible and lightweight.

import { type ReactNode, useEffect, useState } from 'react';
import { clsx } from 'clsx';

export function cn(...parts: any[]) {
  return clsx(...parts);
}

export const inputClass =
  'w-full bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 bg-primary-container text-white text-label-md px-4 py-2 rounded-lg hover:bg-[#264B3E] transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline text-on-surface dark:text-on-surface text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 bg-error/10 text-error dark:text-red-300 border border-error/30 text-label-md px-4 py-2 rounded-lg hover:bg-error/20 transition-colors disabled:opacity-60';
export const iconBtn =
  'p-2 rounded-lg text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant hover:text-primary transition-colors';

export function PageHeader({ title, subtitle, crumbs, actions }: { title: string; subtitle?: string; crumbs?: string[]; actions?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        {crumbs && crumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-label-md text-on-surface-variant dark:text-surface-variant mb-2" aria-label="Breadcrumb">
            <span>BuildSmart AI</span>
            {crumbs.map((c, idx) => (
              <span key={`${c}-${idx}`} className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className={idx === crumbs.length - 1 ? 'text-primary dark:text-primary-fixed-dim font-semibold' : ''}>{c}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-headline-lg text-on-surface dark:text-on-surface">{title}</h1>
        {subtitle && <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={cn('bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-xl shadow-elevation', pad && 'p-6', className)}>
      {children}
    </div>
  );
}

export function StatCard({ icon, label, value, meta, tone = 'default' }: { icon: string; label: string; value: string; meta?: string; tone?: 'default' | 'green' | 'amber' | 'red' | 'blue' }) {
  const toneCls: Record<string, string> = {
    default: 'text-primary dark:text-primary-fixed-dim',
    green: 'text-[#2F6B50] dark:text-primary-fixed-dim',
    amber: 'text-[#A66A00] dark:text-yellow-400',
    red: 'text-error dark:text-red-400',
    blue: 'text-[#2F5F8A] dark:text-sky-400',
  };
  return (
    <Card className="relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-on-surface dark:text-on-surface">
        <span className="material-symbols-outlined text-[56px]">{icon}</span>
      </div>
      <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1 uppercase tracking-wide">{label}</p>
      <p className={cn('text-display leading-tight mb-1', toneCls[tone])}>{value}</p>
      {meta && <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{meta}</p>}
    </Card>
  );
}

const PILL_STYLES: Record<string, string> = {
  green: 'bg-[#Eaf7f1] dark:bg-primary-container text-[#2F6B50] dark:text-on-primary-container border-[#C0E9D7] dark:border-primary',
  amber: 'bg-[#FFF4E5] dark:bg-yellow-900/30 text-[#A66A00] dark:text-yellow-400 border-[#F5D09D] dark:border-yellow-700',
  red: 'bg-error/10 dark:bg-error/20 text-error dark:text-red-300 border-error/30',
  gray: 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline',
  blue: 'bg-[#EAF3FB] dark:bg-sky-900/30 text-[#2F5F8A] dark:text-sky-300 border-[#C4DCF2] dark:border-sky-700',
  purple: 'bg-[#F3EEFB] dark:bg-purple-900/30 text-[#6B4FA0] dark:text-purple-300 border-[#DCCFF2] dark:border-purple-700',
};

export function StatusPill({ status, tone }: { status: string; tone?: string }) {
  const t = tone ?? toneFor(status);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-label-md uppercase tracking-wide border', PILL_STYLES[t] ?? PILL_STYLES.gray)}>
      {status}
    </span>
  );
}

export function toneFor(status: string): string {
  const s = String(status ?? '').toUpperCase();
  if (['COMPLETED', 'APPROVED', 'VERIFIED', 'DELIVERED', 'SUCCEEDED', 'FULLY_VERIFIED', 'CONFIRMED', 'ACTIVE', 'SENT', 'FINAL'].includes(s)) return 'green';
  if (['PENDING', 'NEW', 'UNDER_REVIEW', 'REQUIREMENTS', 'DESIGNING', 'AI_GENERATED', 'PROCESSING', 'INFO_REQUIRED', 'ACCEPTED', 'DRAFT'].includes(s)) return 'amber';
  if (['REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED', 'SUSPENDED', 'NO_SHOW', 'ARCHIVED'].includes(s)) return 'red';
  if (['REVISION', 'CLIENT_REVIEW', 'ARCHITECT_REVIEW'].includes(s)) return 'blue';
  if (['SHIPPED', 'CONVERTED', 'RESCHEDULED', 'CONSTRUCTION_PLANNING'].includes(s)) return 'purple';
  return 'gray';
}

export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="text-center py-12">
      <span className="material-symbols-outlined text-[56px] text-outline-variant dark:text-outline mb-3 block">{icon}</span>
      <h3 className="text-headline-sm text-on-surface dark:text-on-surface mb-1">{title}</h3>
      {body && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">{body}</p>}
      {actionLabel && onAction && (
        <button className={btnPrimary} onClick={onAction}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          {actionLabel}
        </button>
      )}
    </Card>
  );
}

export function Modal({ open, onClose, title, children, wide = false, extraWide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; extraWide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-2xl shadow-2xl w-full my-4', extraWide ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant dark:border-outline">
          <h3 className="text-headline-sm text-on-surface dark:text-on-surface">{title}</h3>
          <button onClick={onClose} className={iconBtn} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-label-md text-on-surface dark:text-on-surface">{label}</span>
      {children}
      {hint && <span className="block text-body-sm text-on-surface-variant dark:text-surface-variant">{hint}</span>}
    </label>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-block animate-spin" style={{ width: size, height: size }} role="status" aria-label="Loading">
      <span className="material-symbols-outlined" style={{ fontSize: size }}>
        progress_activity
      </span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-variant dark:bg-surface-container-high rounded-lg', className)} />;
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; icon?: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-outline-variant dark:border-outline overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-label-md whitespace-nowrap border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-primary dark:border-primary-fixed-dim text-primary dark:text-primary-fixed-dim font-semibold'
              : 'border-transparent text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim'
          )}
        >
          {t.icon && <span className="material-symbols-outlined text-[18px]">{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className, icon }: { label: string; confirmLabel?: string; onConfirm: () => void; className?: string; icon?: string }) {
  return (
    <DangerConfirm label={label} confirmLabel={confirmLabel} onConfirm={onConfirm} className={className} icon={icon} />
  );
}

function DangerConfirm({ label, confirmLabel, onConfirm, className, icon }: { label: string; confirmLabel?: string; onConfirm: () => void; className?: string; icon?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={cn(btnDanger, className)}
      aria-label={armed ? `Confirm ${confirmLabel ?? label}` : label}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {armed ? (confirmLabel ?? 'Confirm?') : label}
    </button>
  );
}
