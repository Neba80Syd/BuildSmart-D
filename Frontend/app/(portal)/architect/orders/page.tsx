'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ArchitectOrdersPage() {
  const { data, loading, refetch } = useApi<{ orders: any[] }>('/api/architect/orders');
  const { data: cartData, refetch: refetchCart } = useApi<{ items: any[] }>('/api/architect/cart');
  const [open, setOpen] = useState<any | null>(null);

  const orders = data?.orders ?? [];
  const cartItems = cartData?.items ?? [];

  const act = async (o: any, action: 'CANCEL' | 'CONFIRM_RECEIPT') => {
    try { await api('PATCH', '/api/architect/orders', { id: o.id, action }); toast.success('Order updated'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };

  const checkout = async () => {
    try {
      const res = await api('POST', '/api/architect/orders');
      toast.success(`Order ${res.orderId} placed (${fmt(res.total)} XAF)`);
      refetch(); refetchCart();
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Orders" subtitle="Track material purchases for your projects." crumbs={['Architect', 'Marketplace', 'Orders']} actions={
        cartItems.length > 0 ? <button className={btnPrimary} onClick={checkout}><span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>Checkout ({cartItems.length})</button> : undefined
      } />

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt_long" title="No orders" body="Place an order from the marketplace to see it here." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} pad={false} className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 p-4 md:p-0 md:pl-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-technical text-body-sm text-on-surface-variant dark:text-surface-variant">{o.id}</span>
                  <StatusPill status={o.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">{o.items.length} item(s) · placed {new Date(o.createdAt).toLocaleDateString()}{o.trackingNumber ? ` · ${o.carrier} ${o.trackingNumber}` : ''}</p>
              </div>
              <p className="text-headline-sm text-primary dark:text-primary-fixed-dim font-semibold p-4 md:p-0 md:pr-4">{fmt(o.totalAmount)} {o.currency}</p>
              <div className="flex gap-2 p-4 md:p-0 md:pr-4">
                <button className={btnGhost} onClick={() => setOpen(o)}>Details</button>
                {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(o.status) && <button className={btnGhost} onClick={() => act(o, 'CANCEL')}>Cancel</button>}
                {o.status === 'SHIPPED' && <button className={btnPrimary} onClick={() => act(o, 'CONFIRM_RECEIPT')}>Confirm Receipt</button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal open title={`Order ${open.id}`} onClose={() => setOpen(null)}>
          <div className="space-y-2">
            {open.items.map((i: any) => (
              <div key={i.id} className="flex justify-between text-body-sm">
                <span className="text-on-surface dark:text-inverse-on-surface">{i.name} × {i.quantity}</span>
                <span className="font-mono-technical text-on-surface-variant dark:text-surface-variant">{fmt(i.total)} {open.currency}</span>
              </div>
            ))}
            <div className="flex justify-between text-body-sm font-semibold pt-2 border-t border-outline-variant dark:border-outline">
              <span className="text-on-surface dark:text-inverse-on-surface">Total</span>
              <span className="font-mono-technical">{fmt(open.totalAmount)} {open.currency}</span>
            </div>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Order totals are calculated and validated server-side.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
