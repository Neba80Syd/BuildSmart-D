'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Field, inputClass, btnPrimary, StatusPill } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function AdminProfilePage() {
  const { data, loading, error, refetch } = useApi<any>('/api/admin/profile');
  const [form, setForm] = useState({ name: '', phone: '', location: '', bio: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm({ name: data.user?.name ?? '', phone: data.profile?.phone ?? '', location: data.profile?.location ?? '', bio: data.profile?.bio ?? '' });
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await api('PATCH', '/api/admin/profile', form);
      toast.success('Profile saved');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Profile" subtitle="Your administrator profile" crumbs={['Admin', 'Account', 'Profile']} />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load profile.</p></Card>
      ) : loading || !data ? (
        <Card><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p></Card>
      ) : (
        <Card className="max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-headline-md font-bold">
              {(data.user?.name ?? 'A').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">{data.user?.name}</h2>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{data.user?.email}</p>
              <div className="mt-1 flex gap-2"><StatusPill status={data.user?.role} tone="purple" /><StatusPill status="SUPER_ADMIN" tone="purple" /></div>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Full name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Bio"><textarea className={inputClass} rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
            <button className={btnPrimary} disabled={busy} onClick={save}>Save changes</button>
          </div>
        </Card>
      )}
    </div>
  );
}
