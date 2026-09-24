'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, StatCard } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, money, fmtDate } from '@/Frontend/components/admin/shared';

export default function AdminInvoicesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/invoices${query ? `?${query}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/invoices', { id, action });
      toast.success(action === 'mark_paid' ? 'Invoice marked paid' : 'Invoice voided');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const s = data?.summary ?? { total: 0, paid: 0, pending: 0, refunded: 0 };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Invoices" subtitle="Track client invoices across projects and orders" crumbs={['Admin', 'Finance', 'Invoices']} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="description" label="Total" value={money(s.total)} />
        <StatCard icon="check_circle" label="Paid" value={money(s.paid)} tone="green" />
        <StatCard icon="pending" label="Pending" value={money(s.pending)} tone="amber" />
        <StatCard icon="assignment_return" label="Refunded" value={money(s.refunded)} tone="red" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search invoices…" /></div>
          <FilterChips options={data?.statuses ?? ['PENDING', 'PAID', 'REFUNDED']} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load invoices.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.invoices?.length ? (
          <EmptyState icon="description" title="No invoices" />
        ) : (
          <TableShell>
            <thead><tr><Th>Number</Th><Th>User</Th><Th>Description</Th><Th>Total</Th><Th>Status</Th><Th>Due</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.invoices.map((i: any) => (
                <tr key={i.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td className="font-mono">{i.number}</Td>
                  <Td>{i.userName}</Td>
                  <Td className="max-w-xs truncate text-on-surface-variant dark:text-surface-variant">{i.description}</Td>
                  <Td className="font-semibold">{money(i.total, i.currency)}</Td>
                  <Td><StatusPill status={i.status} /></Td>
                  <Td>{fmtDate(i.dueAt)}</Td>
                  <Td>
                    <div className="flex gap-2">
                      {i.status === 'PENDING' && <button disabled={busy === i.id + 'mark_paid'} onClick={() => act(i.id, 'mark_paid')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Mark paid</button>}
                      {i.status === 'PENDING' && <button disabled={busy === i.id + 'void'} onClick={() => act(i.id, 'void')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Void</button>}
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
