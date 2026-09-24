'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, money, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminRequestsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/requests${query ? `?${query}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/requests', { id, action });
      toast.success(`Request ${action}ed`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Design Requests" subtitle="Oversight of client-to-architect design requests" crumbs={['Admin', 'Projects', 'Requests']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search requests…" /></div>
          <FilterChips options={data?.statuses ?? []} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load requests.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.requests?.length ? (
          <EmptyState icon="inbox" title="No design requests" />
        ) : (
          <TableShell>
            <thead><tr><Th>Project Type</Th><Th>Description</Th><Th>Client</Th><Th>Architect</Th><Th>Budget</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.requests.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td className="font-semibold text-on-surface dark:text-inverse-on-surface">{r.projectType}</Td>
                  <Td className="max-w-xs"><p className="truncate text-on-surface-variant dark:text-surface-variant">{r.description}</p></Td>
                  <Td>{r.clientName}</Td>
                  <Td>{r.architectName}</Td>
                  <Td>{r.budget ? money(r.budget) : '—'}</Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td>
                    <div className="flex gap-2">
                      <button disabled={busy === r.id + 'escalate'} onClick={() => act(r.id, 'escalate')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Escalate</button>
                      <button disabled={busy === r.id + 'close'} onClick={() => act(r.id, 'close')} className="text-label-md text-on-surface-variant dark:text-surface-variant hover:underline disabled:opacity-50">Close</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
