'use client';

// Shared admin-console UI helpers. Reuses the Stitch design tokens so every
// governance page stays visually consistent with the rest of the platform.

import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/Frontend/components/architect/ui';
import { Modal, Skeleton, inputClass, btnPrimary, btnGhost, btnDanger } from '@/Frontend/components/architect/ui';

export const money = (n: number, currency = 'XAF') =>
  `${Math.round(n || 0).toLocaleString()} ${currency}`;

export const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d: any) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function timeAgo(d: any): string {
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}

export function severityTone(sev: string): string {
  const s = String(sev ?? '').toUpperCase();
  if (s === 'CRITICAL') return 'red';
  if (s === 'HIGH') return 'amber';
  if (s === 'MEDIUM') return 'blue';
  return 'gray';
}

export function priorityTone(p: string): string {
  const s = String(p ?? '').toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH') return 'red';
  if (s === 'MEDIUM') return 'amber';
  return 'gray';
}

// Compact data-table shell used across the console.
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-left border-collapse min-w-[720px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-label-md font-semibold text-on-surface-variant dark:text-surface-variant uppercase tracking-wider border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-container-high whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-body-sm text-on-surface dark:text-on-surface border-b border-outline-variant dark:border-outline align-middle', className)}>{children}</td>;
}

export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3 border-b border-outline-variant dark:border-outline">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant dark:text-surface-variant">search</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} className={cn(inputClass, 'pl-10')} />
    </div>
  );
}

export function FilterChips({ options, value, onChange, label }: { options: string[]; value: string | null; onChange: (v: string | null) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{label}</span>}
      <button
        onClick={() => onChange(null)}
        className={cn('px-3 py-1.5 rounded-full border text-label-md transition-colors', value === null ? 'bg-primary-container text-white border-primary-container' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:border-primary')}
      >
        All
      </button>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? null : o)}
          className={cn('px-3 py-1.5 rounded-full border text-label-md transition-colors', value === o ? 'bg-primary-container text-white border-primary-container' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:border-primary')}
        >
          {o.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}

// Two-step destructive-action confirmation (arming pattern).
export function Confirm({ label, confirmLabel, description, onConfirm, tone = 'danger', disabled }: { label: string; confirmLabel?: string; description?: string; onConfirm: () => void; tone?: 'danger' | 'primary'; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      title={description}
      className={cn(tone === 'danger' ? btnDanger : btnPrimary, disabled && 'opacity-50 pointer-events-none')}
    >
      {armed ? (confirmLabel ?? 'Confirm?') : label}
    </button>
  );
}

export { Modal, btnPrimary, btnGhost, btnDanger, inputClass };
