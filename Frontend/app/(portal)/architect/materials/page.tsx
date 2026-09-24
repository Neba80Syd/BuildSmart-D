'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { PageHeader, Card, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ArchitectMaterialsPage() {
  const router = useRouter();
  const { data, loading } = useApi<{ products: any[] }>('/api/products');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ALL');
  const [quote, setQuote] = useState<any | null>(null);

  const products = data?.products ?? [];
  const cats = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) => (cat === 'ALL' || p.category === cat) && (p.name.toLowerCase().includes(q.toLowerCase())));

  const addToCart = async (p: any) => {
    const session = await getSession();
    if (!session) {
      toast.info('Please sign in to add items to your cart');
      router.push('/login');
      return;
    }
    try { await api('POST', '/api/architect/cart', { productId: p.id, quantity: 1 }); toast.success('Added to cart'); }
    catch (err: any) {
      if (/auth/i.test(err.message ?? '')) {
        router.push('/login');
        return;
      }
      toast.error(err.message);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="Browse Materials" subtitle="Find construction materials, compare prices and request quotations." crumbs={['Architect', 'Marketplace', 'Materials']} actions={
        <input className={inputClass + ' w-64'} placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />

      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-label-md whitespace-nowrap border ${cat === c ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="inventory_2" title="No materials found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} pad={false} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-surface-container-low dark:bg-surface-variant">
                <img src={p.imageUrl || '/images/product-cement.png'} alt={p.name} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                {p.vendorVerified && <span className="absolute top-2 left-2 bg-[#2F6B50] text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">verified</span>Verified</span>}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.category}</p>
                <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface leading-tight">{p.name}</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">{p.vendor} · {p.unit}</p>
                <div className="flex items-baseline justify-between mt-auto">
                  <span className="text-headline-sm text-primary dark:text-primary-fixed-dim font-semibold">{fmt(p.price)} XAF</span>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-outline-variant dark:border-outline">
                  <button className={btnPrimary + ' flex-1'} onClick={() => addToCart(p)}><span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>Cart</button>
                  <button className={btnGhost} onClick={() => setQuote(p)} title="Request quotation"><span className="material-symbols-outlined text-[18px]">request_quote</span></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {quote && <QuoteModal product={quote} onClose={() => setQuote(null)} />}
    </div>
  );
}

function QuoteModal({ product, onClose }: { product: any; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSending(true);
    try {
      await api('POST', '/api/architect/quotes', { vendorId: product.vendorId, productId: product.id, message: fd.get('message') });
      toast.success('Quotation request sent to vendor');
      onClose();
    } catch (err: any) { toast.error(err.message); } finally { setSending(false); }
  };
  return (
    <Modal open title={`Request quotation — ${product.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Message to vendor"><textarea className={inputClass} name="message" rows={3} required minLength={5} defaultValue={`Hello, I would like a quotation for ${product.name} (${product.unit}). Please include lead time and bulk pricing.`} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={sending}>{sending ? 'Sending…' : 'Send Request'}</button>
        </div>
      </form>
    </Modal>
  );
}
