'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientArchitectsPage() {
  const { data, loading } = useApi<{ architects: any[]; myArchitectIds: string[] }>('/api/client/architects');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const favorite = async (a: any) => {
    try { await api('POST', '/api/client/favorites', { resourceType: 'ARCHITECT', resourceId: a.id }); toast.success('Architect saved to favorites'); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div></div>;

  const list = (data?.architects ?? []).filter((a) => (q ? (a.name + ' ' + (a.title ?? '') + ' ' + (a.specializations ?? []).join(' ')).toLowerCase().includes(q.toLowerCase()) : true));
  const mine = new Set(data?.myArchitectIds ?? []);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Architect Discovery" subtitle="Find and evaluate verified architects before submitting a request." crumbs={['Client', 'Architect', 'Architect Profile']}
        actions={<input className="px-3 py-2 rounded-lg border border-outline-variant dark:border-outline text-body-sm bg-white dark:bg-surface-dim dark:text-on-surface w-56" placeholder="Search architects…" value={q} onChange={(e) => setQ(e.target.value)} />} />

      {list.length === 0 ? (
        <EmptyState icon="groups" title="No architects found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full bg-primary-container text-white flex items-center justify-center text-xl font-bold">{a.name.slice(0, 2)}</div>
                <div className="min-w-0">
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface truncate">{a.name}</h3>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant truncate">{a.title}</p>
                </div>
                {mine.has(a.id) && <span className="ml-auto text-[11px] bg-primary/10 text-primary dark:text-primary-fixed-dim px-2 py-0.5 rounded-full">YOUR ARCHITECT</span>}
              </div>
              <div className="flex items-center gap-2 mb-2 text-body-sm text-on-surface-variant dark:text-surface-variant">
                <span>★ {a.rating}</span><span>·</span><span>{a.reviewCount} reviews</span><span>·</span>
                <StatusPill status={a.verificationStatus} />
              </div>
              <div className="flex flex-wrap gap-1 mb-3">{(a.specializations ?? []).slice(0, 3).map((s: string) => <span key={s} className="px-2 py-0.5 rounded-full bg-surface-container-high dark:bg-surface-variant text-label-md text-on-surface-variant dark:text-surface-variant">{s}</span>)}</div>
              <div className="mt-auto flex gap-2 flex-wrap">
                <button className={btnPrimary + ' flex-1'} onClick={() => setDetail(a)}>View Profile</button>
                <button className={btnGhost} onClick={() => favorite(a)}><span className="material-symbols-outlined text-[18px]">favorite</span></button>
                <Link href={`/client/requests?architect=${encodeURIComponent(a.id)}`} className={btnGhost}>Request</Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold">{detail.name.slice(0, 2)}</div>
              <div><h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{detail.name}</h3><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{detail.title} · {detail.location}</p></div>
              <StatusPill status={detail.verificationStatus} />
            </div>
            <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{detail.biography}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">{detail.experience}</p><p className="text-label-md">Years experience</p></div>
              <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">★ {detail.rating}</p><p className="text-label-md">{detail.reviewCount} reviews</p></div>
              <div><p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">{detail.portfolio?.length ?? 0}</p><p className="text-label-md">Portfolio items</p></div>
            </div>
            {(detail.reviews ?? []).slice(0, 3).map((r: any) => (
              <div key={r.id} className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">&ldquo;{r.body}&rdquo;</p>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">— {r.authorName} · {'★'.repeat(r.rating)}</p>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <Link href={`/client/requests?architect=${encodeURIComponent(detail.id)}`} className={btnPrimary}>Send Request</Link>
              <Link href="/client/messages" className={btnGhost}>Message</Link>
              <Link href="/client/appointments" className={btnGhost}>Schedule Consultation</Link>
            </div>
            <p className="text-[11px] text-on-surface-variant dark:text-surface-variant">Private verification documents are never exposed.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
