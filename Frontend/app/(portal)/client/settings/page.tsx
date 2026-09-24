'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Tabs, Field, inputClass, btnPrimary, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientSettingsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/settings');
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState<any>(null);

  const initial = data ? { ...data.settings } : null;
  const current = form ?? initial;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...(f ?? initial), [k]: v }));
  const setNotif = (k: string, v: boolean) => setForm((f: any) => ({ ...(f ?? initial), notifications: { ...(f?.notifications ?? initial?.notifications), [k]: v } }));
  const setPrivacy = (k: string, v: any) => setForm((f: any) => ({ ...(f ?? initial), privacy: { ...(f?.privacy ?? initial?.privacy), [k]: v } }));

  const save = async () => {
    try { await api('PATCH', '/api/client/settings', current); toast.success('Settings saved'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading || !current) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const TABS = [
    { key: 'general', label: 'General', icon: 'tune' },
    { key: 'appearance', label: 'Appearance', icon: 'palette' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications' },
    { key: 'privacy', label: 'Privacy', icon: 'lock' },
  ];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[800px] mx-auto">
      <PageHeader title="Settings" subtitle="Configure your account and workspace preferences." crumbs={['Client', 'Account', 'Settings']} />

      <Card pad={false}>
        <div className="px-5 pt-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
        <div className="p-6 space-y-4">
          {tab === 'general' && (
            <>
              <Field label="Language"><select className={inputClass} value={current.language} onChange={(e) => set('language', e.target.value)}><option value="en">English</option><option value="fr">Français</option></select></Field>
              <Field label="Currency"><select className={inputClass} value={current.currency} onChange={(e) => set('currency', e.target.value)}>{['XAF', 'EUR', 'USD', 'NGN'].map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Measurement units"><select className={inputClass} value={current.units} onChange={(e) => set('units', e.target.value)}>{['METRIC', 'IMPERIAL'].map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label="Time zone"><select className={inputClass} value={current.timezone} onChange={(e) => set('timezone', e.target.value)}>{['Africa/Douala', 'Africa/Lagos', 'Europe/London', 'UTC'].map((t) => <option key={t}>{t}</option>)}</select></Field>
            </>
          )}
          {tab === 'appearance' && (
            <Field label="Theme">
              <div className="flex gap-2">
                {['system', 'light', 'dark'].map((t) => <button key={t} onClick={() => set('theme', t)} className={`px-4 py-2 rounded-lg text-label-md capitalize ${current.theme === t ? 'bg-primary text-white' : 'bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{t}</button>)}
              </div>
            </Field>
          )}
          {tab === 'notifications' && (
            <div className="space-y-3">
              {(Object.keys(current.notifications ?? {}) as string[]).map((k) => (
                <label key={k} className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40">
                  <span className="text-body-sm text-on-surface dark:text-inverse-on-surface capitalize">{k} notifications</span>
                  <input type="checkbox" checked={!!current.notifications[k]} onChange={(e) => setNotif(k, e.target.checked)} className="accent-[#315C4C] w-5 h-5" />
                </label>
              ))}
            </div>
          )}
          {tab === 'privacy' && (
            <>
              <Field label="Profile visibility"><select className={inputClass} value={current.privacy?.profileVisibility ?? 'PUBLIC'} onChange={(e) => setPrivacy('profileVisibility', e.target.value)}>{['PUBLIC', 'PRIVATE'].map((p) => <option key={p}>{p}</option>)}</select></Field>
              <label className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40"><span className="text-body-sm text-on-surface dark:text-inverse-on-surface">Allow architect communication</span><input type="checkbox" checked={!!current.privacy?.communication} onChange={(e) => setPrivacy('communication', e.target.checked)} className="accent-[#315C4C] w-5 h-5" /></label>
              <label className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40"><span className="text-body-sm text-on-surface dark:text-inverse-on-surface">Share data for recommendations</span><input type="checkbox" checked={!!current.privacy?.dataSharing} onChange={(e) => setPrivacy('dataSharing', e.target.checked)} className="accent-[#315C4C] w-5 h-5" /></label>
            </>
          )}
          <div className="flex justify-end pt-2"><button className={btnPrimary} onClick={save}>Save Settings</button></div>
        </div>
      </Card>
    </div>
  );
}
