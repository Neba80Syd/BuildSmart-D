'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Field, inputClass, btnPrimary, StatusPill, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminAccountPage() {
  const { data, loading, error, refetch } = useApi<any>('/api/admin/account');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (pw.length < 8) return toast.error('Password must be at least 8 characters');
    if (pw !== confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      await api('POST', '/api/admin/account', { action: 'changePassword', newPassword: pw });
      toast.success('Password updated');
      setPw('');
      setConfirm('');
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const logoutOthers = async () => {
    setBusy(true);
    try {
      await api('POST', '/api/admin/account', { action: 'logoutOthers' });
      toast.success('Other sessions revoked');
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Account Security" subtitle="Credentials and session management" crumbs={['Admin', 'Account', 'Security']} />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load account.</p></Card>
      ) : loading || !data ? (
        <Card><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Change password</h2>
            {data.authEnabled === false && (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">Authentication is currently in preview mode; password changes still persist to your record.</p>
            )}
            <div className="space-y-4">
              <Field label="New password"><input type="password" className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              <Field label="Confirm password"><input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
              <button className={btnPrimary} disabled={busy} onClick={changePassword}>Update password</button>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-2">Active sessions</h2>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">{data.sessionNote}</p>
              <button className="px-4 py-2 rounded-lg border border-outline-variant dark:border-outline text-label-md" disabled={busy} onClick={logoutOthers}>Revoke all other sessions</button>
            </Card>

            <Card pad={false}>
              <div className="px-6 py-4 border-b border-outline-variant dark:border-outline"><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">Recent login activity</h2></div>
              <div className="divide-y divide-outline-variant dark:divide-outline">
                {(data.loginHistory ?? []).length === 0 ? (
                  <EmptyState icon="history" title="No activity" />
                ) : (
                  data.loginHistory.map((l: any) => (
                    <div key={l.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-body-sm font-medium text-on-surface dark:text-inverse-on-surface">{l.action}</p>
                        <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{l.resource} · {l.ip} · {l.device}</p>
                      </div>
                      <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{timeAgo(l.at)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
