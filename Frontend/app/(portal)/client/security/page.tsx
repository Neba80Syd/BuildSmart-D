'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Skeleton, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientSecurityPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/security');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const changePassword = async () => {
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match');
    if (pw.next.length < 8) return toast.error('Password must be at least 8 characters');
    try { await api('POST', '/api/client/security', { action: 'changePassword', currentPassword: pw.current, newPassword: pw.next }); toast.success('Password updated'); setPw({ current: '', next: '', confirm: '' }); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const logoutOthers = async () => {
    try { await api('POST', '/api/client/security', { action: 'logoutOthers' }); toast.success('Signed out of other sessions'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[800px] mx-auto">
      <PageHeader title="Security" subtitle="Keep your account protected." crumbs={['Client', 'Account', 'Security']} />

      <div className="space-y-4">
        <Card>
          <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Change Password</h3>
          <div className="space-y-3">
            <input className={inputClass} type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <input className={inputClass} type="password" placeholder="New password (min 8 characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <input className={inputClass} type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            <button className={btnPrimary} onClick={changePassword}>Update Password</button>
          </div>
        </Card>

        <Card>
          <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Active Sessions</h3>
          <div className="space-y-2 mb-3">
            {(data?.sessions ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40">
                <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{s.device}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{s.location} · {s.ip}</p></div>
                {s.current ? <span className="text-[11px] bg-primary/10 text-primary dark:text-primary-fixed-dim px-2 py-0.5 rounded-full">THIS DEVICE</span> : <span className="text-label-md text-on-surface-variant dark:text-surface-variant">Active</span>}
              </div>
            ))}
          </div>
          <button className={btnGhost} onClick={logoutOthers}>Sign Out Other Sessions</button>
        </Card>

        <Card>
          <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Recent Activity</h3>
          {data?.events.length === 0 ? (
            <EmptyState icon="monitoring" title="No recent activity" body="Sign-in and security events will appear here." />
          ) : (
            <div className="space-y-2">
              {data.events.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40">
                  <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{e.action}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{e.detail}</p></div>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
