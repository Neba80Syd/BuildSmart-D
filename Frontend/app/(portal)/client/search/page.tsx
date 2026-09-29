'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, Card, EmptyState, Skeleton, StatusPill } from '@/Frontend/components/architect/ui';

const TYPES: Record<string, { label: string; icon: string; href: (r: any) => string }> = {
  project: { label: 'Projects', icon: 'apartment', href: () => '/client/projects' },
  design: { label: 'Designs', icon: 'design_services', href: () => '/client/designs' },
  floorplan: { label: 'Floor Plans', icon: 'floorplan', href: (r) => `/client/floorplans?project=${r.projectId}` },
  feedback: { label: 'Feedback', icon: 'rate_review', href: () => '/client/revisions' },
  architect: { label: 'Architects', icon: 'engineering', href: (r) => `/client/architects` },
  material: { label: 'Materials', icon: 'inventory_2', href: () => '/client/marketplace' },
  order: { label: 'Orders', icon: 'receipt_long', href: () => '/client/orders' },
  invoice: { label: 'Invoices', icon: 'description', href: () => '/client/invoices' },
  document: { label: 'Documents', icon: 'folder', href: () => '/client/documents' },
  request: { label: 'Design Requests', icon: 'post_add', href: () => '/client/requests' },
  notification: { label: 'Notifications', icon: 'notifications', href: () => '/client/notifications' },
  boq: { label: 'BOQs', icon: 'request_quote', href: () => '/client/boq' },
};

export default function ClientSearchPage() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) { setData(null); return; }
    setLoading(true);
    fetch(`/api/client/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [q]);

  const groups = data?.results ?? {};
  const total = Object.values(groups).reduce((acc: number, arr: any) => acc + arr.length, 0);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Search" subtitle={`Global search across your projects, designs, materials and more.`} crumbs={['Client', 'Search']} />

      {!q ? (
        <EmptyState icon="search" title="Search your workspace" body="Use the search bar in the header, or type a query below." />
      ) : loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">{total} result(s) for &ldquo;{q}&rdquo;</p>
          {total === 0 ? (
            <EmptyState icon="search_off" title="No results found" body="Try different keywords — search is scoped to your own resources." />
          ) : (
            Object.entries(groups).map(([key, arr]: [string, any]) =>
              arr.length === 0 ? null : (
                <Card key={key} className="mb-4">
                  <h3 className="text-label-md uppercase tracking-wide text-on-surface-variant dark:text-surface-variant mb-2">{TYPES[key]?.label ?? key}</h3>
                  <div className="space-y-1">
                    {arr.map((r: any) => (
                      <Link key={r.id} href={TYPES[key]?.href(r) ?? '#'} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant">
                        <span className="material-symbols-outlined text-[20px] text-primary dark:text-primary-fixed-dim">{TYPES[key]?.icon ?? 'circle'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">{r.name ?? r.title ?? r.number ?? r.description ?? r.projectType}</p>
                          <p className="text-label-md text-on-surface-variant dark:text-surface-variant truncate">
                            {r.category ?? r.kind ?? r.status ?? ''}{r.version ? ' · V' + r.version : ''}{r.price ? ' · ' + r.price.toLocaleString() + ' ' + r.unit : ''}{r.total ? ' · ' + r.total.toLocaleString() + ' XAF' : ''}
                          </p>
                        </div>
                        {r.status && <StatusPill status={r.status} />}
                      </Link>
                    ))}
                  </div>
                </Card>
              )
            )
          )}
        </>
      )}
    </div>
  );
}
