'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Tabs, Field, inputClass, btnPrimary, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const UNITS = ['METRIC', 'IMPERIAL'];
const CURRENCIES = ['XAF', 'EUR', 'USD', 'NGN'];
const LANGUAGES = [{ code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }];

export default function ArchitectSettingsPage() {
  const { data, loading, refetch } = useApi<any>('/api/architect/settings');
  const [tab, setTab] = useState('account');
  const [form, setForm] = useState<any>(null);

  const initialForm = data ? { name: data.name, location: data.location, bio: data.bio, settings: { ...data.settings } } : null;
  const currentForm = form ?? initialForm;

  if (loading || !currentForm) return <div className="p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...(f ?? initialForm), [k]: v }));
  const setSetting = (k: string, v: any) => setForm((f: any) => ({ ...(f ?? initialForm), settings: { ...(f?.settings ?? initialForm?.settings), [k]: v } }));
  const setNotif = (k: string, v: boolean) => setForm((f: any) => ({ ...(f ?? initialForm), settings: { ...(f?.settings ?? initialForm?.settings), notifications: { ...((f?.settings?.notifications ?? initialForm?.settings?.notifications) ?? {}), [k]: v } } }));

  const save = async () => {
    try {
      if (tab === 'account') {
        await api('PATCH', '/api/architect/settings', { section: 'account', name: currentForm.name, location: currentForm.location, bio: currentForm.bio });
      } else {
        await api('PATCH', '/api/architect/settings', { section: tab, settings: currentForm.settings });
      }
      toast.success('Settings saved');
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const TABS = [
    { key: 'account', label: 'Account', icon: 'person' },
    { key: 'appearance', label: 'Appearance', icon: 'palette' },
    { key: 'language', label: 'Language', icon: 'translate' },
    { key: 'units', label: 'Units & Currency', icon: 'straighten' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications' },
  ];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Settings" subtitle="Configure your account and workspace preferences." crumbs={['Architect', 'System', 'Settings']} />

      <Card pad={false}>
        <div className="px-5 pt-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
        <div className="p-6 space-y-4">
          {tab === 'account' && (
            <>
              <Field label="Full name"><input className={inputClass} value={currentForm.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Location"><input className={inputClass} value={currentForm.location} onChange={(e) => set('location', e.target.value)} /></Field>
              <Field label="Bio"><textarea className={inputClass} rows={3} value={currentForm.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
            </>
          )}
          {tab === 'appearance' && (
            <Field label="Theme preference">
              <div className="flex gap-2">
                {['system', 'light', 'dark'].map((t) => (
                  <button key={t} onClick={() => setSetting('theme', t)} className={`px-4 py-2 rounded-lg text-label-md capitalize ${currentForm.settings.theme === t ? 'bg-primary text-white' : 'bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{t}</button>
                ))}
              </div>
            </Field>
          )}
          {tab === 'language' && (
            <Field label="Language">
              <select className={inputClass} value={currentForm.settings.language} onChange={(e) => setSetting('language', e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </Field>
          )}
          {tab === 'units' && (
            <>
              <Field label="Measurement units">
                <select className={inputClass} value={currentForm.settings.units} onChange={(e) => setSetting('units', e.target.value)}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Preferred currency">
                <select className={inputClass} value={currentForm.settings.currency} onChange={(e) => setSetting('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </>
          )}
          {tab === 'notifications' && (
            <div className="space-y-3">
              {(Object.keys(currentForm.settings.notifications ?? {}) as string[]).map((k) => (
                <label key={k} className="flex items-center justify-between py-2 border-b border-outline-variant/50 dark:border-outline/40">
                  <span className="text-body-sm text-on-surface dark:text-inverse-on-surface capitalize">{k} notifications</span>
                  <input type="checkbox" checked={!!currentForm.settings.notifications[k]} onChange={(e) => setNotif(k, e.target.checked)} className="accent-[#315C4C] w-5 h-5" />
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button className={btnPrimary} onClick={save}>Save Settings</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
