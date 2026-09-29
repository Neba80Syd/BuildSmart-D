'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ArchitectSecurityPage() {
  const { data, loading, refetch } = useApi<any>('/api/architect/security');
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) return toast.error('Passwords do not match');
    if (pwd.next.length < 8) return toast.error('Password must be at least 8 characters');
    setSaving(true);
    try {
      await api('POST', '/api/architect/security', { action: 'changePassword', currentPassword: pwd.current, newPassword: pwd.next });
      toast.success('Password changed');
      setPwd({ current: '', next: '', confirm: '' });
      refetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const logoutOthers = async () => {
    try { await api('POST', '/api/architect/security', { action: 'logoutOthers' }); toast.success('Other sessions signed out'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };

  const events = data?.events ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Security" subtitle="Manage your account security and recent activity." crumbs={['Architect', 'System', 'Security']} />

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Change Password</h3>
            <form onSubmit={changePassword} className="space-y-4 max-w-md">
              <Field label="Current password"><input className={inputClass} type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></Field>
              <Field label="New password" hint="At least 8 characters"><input className={inputClass} type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
              <Field label="Confirm new password"><input className={inputClass} type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
              <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Update Password'}</button>
            </form>
          </Card>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-1">Two-Factor Authentication</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-3">2FA becomes available when authentication is re-enabled (currently in preview mode).</p>
            <StatusPill status={data?.authEnabled ? 'ENABLED' : 'AUTH DISABLED (PREVIEW)'} tone="gray" />
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Active Sessions</h3>
              <button className={btnGhost} onClick={logoutOthers}>Sign out other sessions</button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">devices</span>
                  <div>
                    <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">Current session</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">This device · {data?.lastLogin ? new Date(data.lastLogin).toLocaleString() : '—'}</p>
                  </div>
                </div>
                <StatusPill status="ACTIVE" />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Recent Security Activity</h3>
            {events.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No security events recorded.</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div>
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{ev.title}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(ev.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant">shield</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
