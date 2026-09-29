'use client';

import { useMemo, useState } from 'react';
import { PageHeader, Card, EmptyState, StatusPill } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminActivityPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, type]);

  const { data, loading, error } = useApi<any>(`/api/admin/activity${query ? `?${query}` : ''}`);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Activity Logs" subtitle="Operational activity across the platform" crumbs={['Admin', 'System', 'Activity']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search activity…" /></div>
          <FilterChips options={data?.types ?? []} value={type} onChange={setType} label="Type" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load activity.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={4} /></tbody></TableShell>
        ) : !data?.activities?.length ? (
          <EmptyState icon="history" title="No activity" />
        ) : (
          <TableShell>
            <thead><tr><Th>Type</Th><Th>Event</Th><Th>User</Th><Th>When</Th></tr></thead>
            <tbody>
              {data.activities.map((a: any) => (
                <tr key={a.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td><StatusPill status={a.type} /></Td>
                  <Td>
                    <p className="font-medium text-on-surface dark:text-inverse-on-surface">{a.title}</p>
                    {a.body && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{a.body}</p>}
                  </Td>
                  <Td>{a.userName}</Td>
                  <Td>{timeAgo(a.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
