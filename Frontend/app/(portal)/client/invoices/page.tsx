'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

export default function ClientInvoicesPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/payments');
  const [detail, setDetail] = useState<any>(null);
  const [q, setQ] = useState('');

  const pay = async () => {
    try { await api('POST', '/api/client/payments', { invoiceId: detail.id, method: 'CARD' }); toast.success('Invoice paid'); setDetail(null); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const download = (i: any) => {
    const txt = `INVOICE ${i.number}\n================\nDescription: ${i.description}\nSubtotal: ${fmt(i.subtotal)} ${i.currency}\nFees: ${fmt(i.fees)} ${i.currency}\nTotal: ${fmt(i.total)} ${i.currency}\nStatus: ${i.status}\nDate: ${new Date(i.createdAt).toLocaleDateString()}\n`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${i.number}.txt`; a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const invoices = (data?.invoices ?? []).filter((i: any) => (q ? (i.number + ' ' + (i.description ?? '')).toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Invoices" subtitle="Centralized access to your financial documents." crumbs={['Client', 'Payments', 'Invoices']}
        actions={<input className="px-3 py-2 rounded-lg border border-outline-variant dark:border-outline text-body-sm bg-white dark:bg-surface-dim dark:text-on-surface" placeholder="Search invoices…" value={q} onChange={(e) => setQ(e.target.value)} />} />

      {invoices.length === 0 ? (
        <EmptyState icon="description" title="No invoices yet" />
      ) : (
        <div className="space-y-2">
          {invoices.map((i: any) => (
            <Card key={i.id} className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1"><h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{i.number}</h3><StatusPill status={i.status} /></div>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{i.description}{i.projectName ? ' · ' + i.projectName : ''}</p>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(i.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">{fmt(i.total)} {i.currency}</span>
                <button className={btnGhost} onClick={() => setDetail(i)}>View</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.number ?? ''}`}>
        {detail && (
          <div className="space-y-3">
            <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{detail.description}</p>
            <div className="space-y-1 text-body-sm text-on-surface dark:text-inverse-on-surface border-t border-outline-variant/50 dark:border-outline/40 pt-2">
              <p className="flex justify-between"><span>Subtotal</span><span>{fmt(detail.subtotal)} {detail.currency}</span></p>
              <p className="flex justify-between"><span>Fees / taxes</span><span>{fmt(detail.fees)} {detail.currency}</span></p>
              <p className="flex justify-between font-semibold"><span>Total</span><span>{fmt(detail.total)} {detail.currency}</span></p>
            </div>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Issued {new Date(detail.createdAt).toLocaleDateString()} · Due {new Date(detail.dueAt).toLocaleDateString()} · <StatusPill status={detail.status} /></p>
            <div className="flex gap-2">
              {detail.status === 'PENDING' && <button className={btnPrimary} onClick={pay}>Pay Now</button>}
              <button className={btnGhost} onClick={() => download(detail)}>Download</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
