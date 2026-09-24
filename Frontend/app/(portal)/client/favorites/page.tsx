'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const FILTERS = ['All', 'Architects', 'Designs', 'Materials', 'Vendors'];

export default function ClientFavoritesPage() {
  const { data, loading, refetch } = useApi<{ favorites: any[] }>('/api/client/favorites');
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');

  const remove = async (f: any) => {
    try { await api('DELETE', '/api/client/favorites', { resourceType: f.resourceType, resourceId: f.resourceId }); toast.success('Removed from favorites'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;
  const favorites = (data?.favorites ?? []).filter((f) => (filter === 'All' ? true : f.resource.type === filter.slice(0, -1).toUpperCase()));
  const list = favorites.filter((f) => (q ? (f.resource.name ?? '').toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1000px] mx-auto">
      <PageHeader title="Favorites" subtitle="Your private saved architects, designs, materials and vendors." crumbs={['Client', 'My Projects', 'Favorites']} />

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-label-md ${filter === f ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>{f}</button>)}
        <input className="ml-auto px-3 py-1.5 rounded-lg border border-outline-variant dark:border-outline text-body-sm max-w-xs bg-white dark:bg-surface-dim dark:text-on-surface" placeholder="Search favorites…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <EmptyState icon="favorite" title="No favorites" body="Save architects, designs, materials or vendors for quick access." />
      ) : (
        <div className="space-y-2">
          {list.map((f) => {
            const r = f.resource;
            const href = r.type === 'ARCHITECT' ? '/client/architects' : r.type === 'DESIGN' ? '/client/designs' : r.type === 'MATERIAL' ? '/client/marketplace' : '/client/architects';
            return (
              <Card key={f.id} className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[24px] text-primary dark:text-primary-fixed-dim">
                  {r.type === 'ARCHITECT' ? 'engineering' : r.type === 'DESIGN' ? 'collections_bookmark' : r.type === 'MATERIAL' ? 'inventory_2' : 'storefront'}
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={href} className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface hover:text-primary">{r.name}</Link>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{r.type}{r.title ? ' · ' + r.title : ''}{r.category ? ' · ' + r.category : ''}</p>
                </div>
                {r.verificationStatus && <StatusPill status={r.verificationStatus} />}
                {r.price != null && <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{r.price.toLocaleString()} {r.unit}</span>}
                <button onClick={() => remove(f)} className="text-on-surface-variant dark:text-surface-variant hover:text-error"><span className="material-symbols-outlined">favorite</span></button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
