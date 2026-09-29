'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Tabs, Field, inputClass, btnPrimary } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const KEYS = ['general', 'marketplace', 'security', 'notifications'] as const;

export default function AdminSettingsPage() {
  const { data, loading, error, refetch } = useApi<any>('/api/admin/settings');
  const [tab, setTab] = useState<string>('general');
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm({ ...data.settings });
  }, [data]);

  const value = (key: string): any => form[key] ?? {};
  const setField = (key: string, field: string, v: any) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? {}), [field]: v } }));

  const save = async (key: string) => {
    setBusy(true);
    try {
      await api('PATCH', '/api/admin/settings', { key, value: value(key) });
      toast.success('Settings saved');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Platform Settings" subtitle="Configure platform-wide behaviour" crumbs={['Admin', 'Settings']} />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load settings.</p></Card>
      ) : loading || !data ? (
        <Card><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p></Card>
      ) : (
        <>
          <Tabs tabs={KEYS.map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))} active={tab} onChange={setTab} />

          <Card className="mt-4 max-w-2xl">
            {tab === 'general' && (
              <div className="space-y-4">
                <Field label="Platform name"><input className={inputClass} value={value('general').platformName ?? 'BuildSmart AI'} onChange={(e) => setField('general', 'platformName', e.target.value)} /></Field>
                <Field label="Support email"><input className={inputClass} value={value('general').supportEmail ?? ''} onChange={(e) => setField('general', 'supportEmail', e.target.value)} /></Field>
                <Field label="Default currency"><input className={inputClass} value={value('general').currency ?? 'XAF'} onChange={(e) => setField('general', 'currency', e.target.value)} /></Field>
                <Field label="Maintenance mode">
                  <select className={inputClass} value={value('general').maintenanceMode ? 'on' : 'off'} onChange={(e) => setField('general', 'maintenanceMode', e.target.value === 'on')}>
                    <option value="off">Off</option><option value="on">On</option>
                  </select>
                </Field>
              </div>
            )}
            {tab === 'marketplace' && (
              <div className="space-y-4">
                <Field label="Commission rate (%)"><input className={inputClass} type="number" value={value('marketplace').commissionRate ?? 5} onChange={(e) => setField('marketplace', 'commissionRate', Number(e.target.value))} /></Field>
                <Field label="Auto-approve new listings">
                  <select className={inputClass} value={value('marketplace').autoApprove ? 'on' : 'off'} onChange={(e) => setField('marketplace', 'autoApprove', e.target.value === 'on')}>
                    <option value="off">Off</option><option value="on">On</option>
                  </select>
                </Field>
              </div>
            )}
            {tab === 'security' && (
              <div className="space-y-4">
                <Field label="Login attempts before lockout"><input className={inputClass} type="number" value={value('security').maxLoginAttempts ?? 5} onChange={(e) => setField('security', 'maxLoginAttempts', Number(e.target.value))} /></Field>
                <Field label="Session timeout (minutes)"><input className={inputClass} type="number" value={value('security').sessionTimeoutMins ?? 60} onChange={(e) => setField('security', 'sessionTimeoutMins', Number(e.target.value))} /></Field>
                <Field label="Require 2FA for admins">
                  <select className={inputClass} value={value('security').require2fa ? 'on' : 'off'} onChange={(e) => setField('security', 'require2fa', e.target.value === 'on')}>
                    <option value="off">Off</option><option value="on">On</option>
                  </select>
                </Field>
              </div>
            )}
            {tab === 'notifications' && (
              <div className="space-y-4">
                {['verification', 'orders', 'security', 'support'].map((n) => (
                  <label key={n} className="flex items-center gap-2 text-body-sm">
                    <input type="checkbox" className="accent-[#2F6B50]" checked={!!value('notifications')[n]} onChange={(e) => setField('notifications', n, e.target.checked)} />
                    <span className="capitalize">{n} notifications</span>
                  </label>
                ))}
              </div>
            )}
            <div className="pt-4 border-t border-outline-variant dark:border-outline mt-4">
              <button className={btnPrimary} disabled={busy} onClick={() => save(tab)}>Save {tab} settings</button>
            </div>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-3">Changes are applied immediately and recorded in the audit log. Secrets are never stored here.</p>
          </Card>
        </>
      )}
    </div>
  );
}
