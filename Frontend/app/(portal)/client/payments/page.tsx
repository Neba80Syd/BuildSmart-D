'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatCard, StatusPill, EmptyState, Modal, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();
const METHODS = ['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'];

export default function ClientPaymentsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/payments');
  const [payFor, setPayFor] = useState<any>(null);
  const [method, setMethod] = useState('CARD');

  const pay = async () => {
    try { await api('POST', '/api/client/payments', { invoiceId: payFor.id, method }); toast.success('Payment successful'); setPayFor(null); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;

  const pendingInvoices = (data?.invoices ?? []).filter((i: any) => i.status === 'PENDING');

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1000px] mx-auto">
      <PageHeader title="Payments" subtitle="Manage payments associated with architectural services and orders." crumbs={['Client', 'Payments', 'Payments']} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="pending_actions" label="Pending" value={fmt(data?.summary.pending)} tone="amber" />
        <StatCard icon="check_circle" label="Paid (total)" value={fmt(data?.summary.paid)} tone="green" />
        <StatCard icon="undo" label="Refunded" value={fmt(data?.summary.refunded)} />
        <StatCard icon="error" label="Failed" value={String(data?.summary.failed)} tone="red" />
      </div>

      <Card className="mb-6">
        <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Pending Invoices</h3>
        {pendingInvoices.length === 0 ? (
          <EmptyState icon="payments" title="No pending payments" body="You're all settled up." />
        ) : (
          <div className="space-y-2">
            {pendingInvoices.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{i.number} — {i.description}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Due {new Date(i.dueAt).toLocaleDateString()}</p></div>
                <div className="flex items-center gap-3"><span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{fmt(i.total)} XAF</span><button className={btnPrimary} onClick={() => setPayFor(i)}>Pay Now</button></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Payment History</h3>
        {data?.payments.length === 0 ? (
          <EmptyState icon="receipt_long" title="No payments yet" />
        ) : (
          <div className="space-y-2">
            {data.payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.description}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(p.createdAt).toLocaleString()}</p></div>
                <div className="flex items-center gap-3"><span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{fmt(p.amount)} {p.currency}</span><StatusPill status={p.status} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`Pay ${payFor?.number ?? ''}`}>
        <div className="space-y-4">
          <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{payFor?.description}</p>
          <p className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">{fmt(payFor?.total)} {payFor?.currency}</p>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <label key={m} className={`flex items-center gap-3 p-3 rounded-lg border ${method === m ? 'border-primary' : 'border-outline-variant dark:border-outline'}`}>
                <input type="radio" checked={method === m} onChange={() => setMethod(m)} /> <span className="text-body-sm text-on-surface dark:text-inverse-on-surface capitalize">{m.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
          <button className={btnPrimary + ' w-full'} onClick={pay}>Confirm Payment</button>
          <p className="text-[11px] text-on-surface-variant dark:text-surface-variant">Amounts are validated server-side and cannot be modified.</p>
        </div>
      </Modal>
    </div>
  );
}
