'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ArchitectVendorsPage() {
  const { data, loading } = useApi<{ vendors: any[] }>('/api/architect/vendors');
  const [quote, setQuote] = useState<any | null>(null);

  const vendors = data?.vendors ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Vendors" subtitle="Discover verified material suppliers and compare their offerings." crumbs={['Architect', 'Marketplace', 'Vendors']} />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : vendors.length === 0 ? (
        <EmptyState icon="storefront" title="No vendors yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((v) => (
            <Card key={v.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg bg-surface-container-low dark:bg-surface-variant flex items-center justify-center overflow-hidden shrink-0">
                  {v.logoUrl ? <img src={v.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">storefront</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{v.name}</h3>
                    <StatusPill status={v.verificationStatus} />
                  </div>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{v.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="flex items-center gap-1 text-headline-sm text-[#A66A00] dark:text-yellow-400"><span className="material-symbols-outlined text-[18px]">star</span>{v.rating?.toFixed(1) ?? '—'}</span>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{v.reviewCount} reviews</p>
                </div>
              </div>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant line-clamp-2">{v.description}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant dark:border-outline">
                <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{v.productCount} products</span>
                <button className={btnPrimary + ' ml-auto'} onClick={() => setQuote(v)}><span className="material-symbols-outlined text-[18px]">request_quote</span>Request Quotation</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {quote && <VendorQuoteModal vendor={quote} onClose={() => setQuote(null)} />}
    </div>
  );
}

function VendorQuoteModal({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSending(true);
    try {
      await api('POST', '/api/architect/quotes', { vendorId: vendor.id, message: fd.get('message') });
      toast.success('Quotation request sent');
      onClose();
    } catch (err: any) { toast.error(err.message); } finally { setSending(false); }
  };
  return (
    <Modal open title={`Contact ${vendor.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Message"><textarea className={inputClass} name="message" rows={3} required minLength={5} defaultValue={`Hello ${vendor.name}, I would like a quotation for materials for one of my projects. Please get in touch.`} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </Modal>
  );
}
