'use client';

import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';

export default function ClientArchitectPage() {
  const { data, loading } = useApi<{ architects: any[] }>('/api/client/architects?mine=1');

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;
  const architects = data?.architects ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="My Architect" subtitle="Direct access to the architect assigned to your projects." crumbs={['Client', 'Architect', 'My Architect']} />

      {architects.length === 0 ? (
        <EmptyState icon="engineering" title="No architect assigned yet" body="Browse verified architects and submit a design request to get started." actionLabel="Discover Architects" onAction={() => (window.location.href = '/client/architects')} />
      ) : (
        <div className="space-y-6">
          {architects.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-primary-container text-white flex items-center justify-center text-3xl font-bold">{a.name.slice(0, 2)}</div>
                  {a.verificationStatus === 'VERIFIED' && <span className="flex items-center gap-1 text-label-md text-primary dark:text-primary-fixed-dim mt-2"><span className="material-symbols-outlined text-[18px]">verified</span>Verified</span>}
                </div>
                <div className="flex-1">
                  <h3 className="text-headline-md text-on-surface dark:text-inverse-on-surface">{a.name}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-2">{a.title}{a.location ? ' · ' + a.location : ''}</p>
                  <div className="flex flex-wrap gap-1 mb-3">{(a.specializations ?? []).map((s: string) => <span key={s} className="px-2 py-0.5 rounded-full bg-surface-container-high dark:bg-surface-variant text-label-md text-on-surface-variant dark:text-surface-variant">{s}</span>)}</div>
                  <p className="text-body-sm text-on-surface dark:text-inverse-on-surface mb-3">{a.biography}</p>
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">{a.experience}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Years exp.</p></div>
                    <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">★ {a.rating}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{a.reviewCount} reviews</p></div>
                    <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">{a.activeProjects}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Active projects</p></div>
                  </div>
                  {a.assignedProjects?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-label-md font-semibold text-on-surface-variant dark:text-surface-variant mb-1">Assigned projects</p>
                      <div className="space-y-1">{(a.assignedProjects ?? []).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-body-sm text-on-surface dark:text-inverse-on-surface"><span>{p.name}</span><StatusPill status={p.status} /></div>
                      ))}</div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href="/client/messages" className={btnPrimary}>Message</Link>
                    <Link href="/client/appointments" className={btnGhost}>Schedule Appointment</Link>
                    <Link href="/client/architects" className={btnGhost}>View Full Profile</Link>
                    <Link href={`/client/requests?architect=${encodeURIComponent(a.id)}`} className={btnGhost}>Submit Request</Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
