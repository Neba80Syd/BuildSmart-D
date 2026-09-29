'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, Field, inputClass, btnPrimary, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientProfilePage() {
  const { data, loading, refetch } = useApi<any>('/api/client/profile');
  const [form, setForm] = useState<any>(null);

  const initial = data ? { name: data.user.name, email: data.user.email, phone: data.profile?.phone ?? '', location: data.profile?.location ?? '', bio: data.profile?.bio ?? '' } : null;
  const current = form ?? initial;

  const save = async () => {
    try { await api('PATCH', '/api/client/profile', current); toast.success('Profile saved'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading || !current) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Profile" subtitle="Manage your personal account information." crumbs={['Client', 'Account', 'Profile']} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold">{data.user.name.slice(0, 2)}</div>
            <div>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{data.user.name}</h3>
              <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.user.email}</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Full name"><input className={inputClass} value={current.name} onChange={(e) => setForm({ ...current, name: e.target.value })} /></Field>
            <Field label="Email" hint="Email changes require re-authentication."><input className={inputClass} value={current.email} disabled /></Field>
            <Field label="Phone"><input className={inputClass} value={current.phone} onChange={(e) => setForm({ ...current, phone: e.target.value })} /></Field>
            <Field label="Location"><input className={inputClass} value={current.location} onChange={(e) => setForm({ ...current, location: e.target.value })} /></Field>
            <Field label="Bio"><textarea className={inputClass} rows={3} value={current.bio} onChange={(e) => setForm({ ...current, bio: e.target.value })} /></Field>
            <button className={btnPrimary} onClick={save}>Save Profile</button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">Preferences</h4>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-3">Language, currency and units are managed in Settings.</p>
            <Link href="/client/settings" className={btnPrimary}>Open Settings</Link>
          </Card>
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">My Architect</h4>
            {data.architect ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold">{data.architect.name.slice(0, 2)}</div>
                  <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{data.architect.name}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.architect.title}</p></div>
                  <StatusPill status={data.architect.verificationStatus} />
                </div>
                <Link href="/client/architect" className="text-label-md text-primary dark:text-primary-fixed-dim">View architect profile</Link>
              </div>
            ) : (
              <Link href="/client/architects" className="text-label-md text-primary dark:text-primary-fixed-dim">Discover architects</Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
