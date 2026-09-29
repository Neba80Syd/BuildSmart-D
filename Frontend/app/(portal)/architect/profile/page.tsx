'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ArchitectProfilePage() {
  const { data, loading, refetch } = useApi<any>('/api/profile');
  const [form, setForm] = useState<any>(null);

  const profile = data?.roleProfile ?? {};
  const user = data?.user ?? {};

  const initialForm = data
    ? {
        name: user.name,
        location: data.profile?.location ?? '',
        bio: data.profile?.bio ?? '',
        biography: profile.biography ?? '',
        title: profile.title ?? '',
        specializations: parseJson(profile.specializations, []).join(', '),
        languages: parseJson(profile.languages, []).join(', '),
        serviceAreas: parseJson(profile.serviceAreas, []).join(', '),
        hourlyRate: profile.hourlyRate ?? 0,
      }
    : null;
  const currentForm = form ?? initialForm;

  const set = (k: string, v: string) => setForm((f: any) => ({ ...(f ?? initialForm), [k]: v }));

  const save = async () => {
    try {
      await api('PATCH', '/api/profile', { name: currentForm.name, location: currentForm.location, bio: currentForm.bio });
      await api('PATCH', '/api/architect/settings', { section: 'account' });
      // Professional fields persist via verification-style update on architectProfile.
      await api('PATCH', '/api/architect/profile', {
        title: currentForm.title, biography: currentForm.biography, hourlyRate: Number(currentForm.hourlyRate || 0),
        specializations: currentForm.specializations.split(',').map((s: string) => s.trim()).filter(Boolean),
        languages: currentForm.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
        serviceAreas: currentForm.serviceAreas.split(',').map((s: string) => s.trim()).filter(Boolean),
      });
      toast.success('Profile saved');
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading || !currentForm) return <div className="p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const portfolio = parseJson(profile.portfolio, []);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Professional Profile" subtitle="Manage your professional identity and public presence." crumbs={['Architect', 'Professional', 'Profile']} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name"><input className={inputClass} value={currentForm.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Professional title"><input className={inputClass} value={currentForm.title} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Location"><input className={inputClass} value={currentForm.location} onChange={(e) => set('location', e.target.value)} /></Field>
              <Field label="Hourly rate (XAF)"><input className={inputClass} type="number" value={currentForm.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} /></Field>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Biography"><textarea className={inputClass} rows={3} value={currentForm.biography} onChange={(e) => set('biography', e.target.value)} /></Field>
              <Field label="Specializations (comma-separated)"><input className={inputClass} value={currentForm.specializations} onChange={(e) => set('specializations', e.target.value)} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Languages"><input className={inputClass} value={currentForm.languages} onChange={(e) => set('languages', e.target.value)} /></Field>
                <Field label="Areas of service"><input className={inputClass} value={currentForm.serviceAreas} onChange={(e) => set('serviceAreas', e.target.value)} /></Field>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button className={btnPrimary} onClick={save}>Save Profile</button>
            </div>
          </Card>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Portfolio</h3>
            {portfolio.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No portfolio items yet.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {portfolio.map((p: any, i: number) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-outline-variant dark:border-outline">
                    <img src={p.image} alt={p.title} className="w-full aspect-video object-cover" />
                    <div className="p-2">
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.title}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">{initials(user.name)}</div>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{user.name}</h3>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{user.email}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <StatusPill status={profile.verificationStatus ?? 'UNVERIFIED'} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-center">
              <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant"><p className="text-headline-sm text-[#A66A00] dark:text-yellow-400">{profile.rating ?? 0}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Rating</p></div>
              <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant"><p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{profile.reviewCount ?? 0}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Reviews</p></div>
            </div>
            <a href="/architect/verification" className={btnGhost + ' w-full mt-4'}>Verification & Credentials</a>
          </Card>
        </div>
      </div>
    </div>
  );
}

function parseJson(v: any, fallback: any) {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}
function initials(name?: string) {
  return (name ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
