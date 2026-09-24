'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, Confirm, money, fmtDate } from '@/Frontend/components/admin/shared';

export default function AdminOrdersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/orders${query ? `?${query}` : ''}`);
  const detailApi = useApi<any>(detail ? `/api/admin/orders?id=${detail.id}` : '');

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/orders', { id, action });
      toast.success(`Order ${action}ed`);
      refetch();
      setDetail(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Orders" subtitle="Oversee marketplace orders and refunds" crumbs={['Admin', 'Marketplace', 'Orders']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search order id or tracking…" /></div>
          <FilterChips options={data?.statuses ?? []} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load orders.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.orders?.length ? (
          <EmptyState icon="receipt_long" title="No orders" />
        ) : (
          <TableShell>
            <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Total</Th><Th>Status</Th><Th>Placed</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.orders.map((o: any) => (
                <tr key={o.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => setDetail(o)} className="font-mono text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed-dim">{o.id}</button>
                  </Td>
                  <Td>{o.userName}</Td>
                  <Td>{o.itemCount}</Td>
                  <Td>{money(o.totalAmount, o.currency)}</Td>
                  <Td><StatusPill status={o.status} /></Td>
                  <Td>{fmtDate(o.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setDetail(o)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">View</button>
                      {!['CANCELLED', 'REFUNDED'].includes(o.status) && (
                        <>
                          <button disabled={busy === o.id + 'cancel'} onClick={() => act(o.id, 'cancel')} className="text-label-md text-on-surface-variant dark:text-surface-variant hover:underline disabled:opacity-50">Cancel</button>
                          <button disabled={busy === o.id + 'refund'} onClick={() => act(o.id, 'refund')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Refund</button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Order ${detail.id}` : ''} wide>
        {detail && detailApi.data && (
          <div className="space-y-4 text-body-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Customer</p><p className="font-medium">{detailApi.data.order.userName}</p></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Status</p><StatusPill status={detailApi.data.order.status} /></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Total</p><p className="font-semibold">{money(detailApi.data.order.totalAmount, detailApi.data.order.currency)}</p></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Tracking</p><p>{detailApi.data.order.trackingNumber ?? '—'}</p></div>
            </div>
            <div>
              <p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase mb-2">Items</p>
              <ul className="space-y-2">
                {detailApi.data.items.map((i: any) => (
                  <li key={i.id} className="flex items-center justify-between p-2 rounded-lg border border-outline-variant dark:border-outline">
                    <span>{i.name}</span>
                    <span className="text-on-surface-variant dark:text-surface-variant">{i.quantity} × {money(i.unitPrice)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {!['CANCELLED', 'REFUNDED'].includes(detailApi.data.order.status) && (
                <>
                  <Confirm label="Cancel order" onConfirm={() => act(detail.id, 'cancel')} />
                  <Confirm label="Refund order" confirmLabel="Confirm refund?" onConfirm={() => act(detail.id, 'refund')} />
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
