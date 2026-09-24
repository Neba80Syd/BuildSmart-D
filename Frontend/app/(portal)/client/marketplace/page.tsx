'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientMarketplacePage() {
  const router = useRouter();
  const { data, loading } = useApi<{ products: any[] }>('/api/products');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [quoteFor, setQuoteFor] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const categories = [...new Set((data?.products ?? []).map((p: any) => p.category))];
  let list = (data?.products ?? []).filter((p: any) => (cat ? p.category === cat : true)).filter((p: any) => (q ? (p.name + ' ' + p.category).toLowerCase().includes(q.toLowerCase()) : true));
  if (sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
  if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));

  const addToCart = async (id: string) => {
    const session = await getSession();
    if (!session) {
      toast.info('Please sign in to add items to your cart');
      router.push('/login');
      return;
    }
    try { await api('POST', '/api/cart', { productId: id, quantity: 1 }); toast.success('Added to cart'); }
    catch (e: any) {
      if (/auth/i.test(e.message ?? '')) {
        router.push('/login');
        return;
      }
      toast.error(e.message);
    }
  };
  const favorite = async (id: string) => {
    try { await api('POST', '/api/client/favorites', { resourceType: 'MATERIAL', resourceId: id }); toast.success('Saved to favorites'); }
    catch (e: any) { toast.error(e.message); }
  };
  const sendQuote = async () => {
    try { await api('POST', '/api/client/quotes', { vendorId: quoteFor.vendorId, productId: quoteFor.id, subject: `Quote for ${quoteFor.name}`, message: msg }); toast.success('Quotation request sent'); setQuoteFor(null); setMsg(''); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div></div>;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="Marketplace" subtitle="Purchase construction materials related to your projects." crumbs={['Client', 'Materials', 'Marketplace']}
        actions={<Link href="/client/orders" className={btnGhost}>View Orders</Link>} />

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCat('')} className={`px-3 py-1.5 rounded-full text-label-md ${cat === '' ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>All</button>
        {categories.map((c) => <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-label-md ${cat === c ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>{c}</button>)}
        <div className="ml-auto flex gap-2">
          <input className="px-3 py-1.5 rounded-lg border border-outline-variant dark:border-outline text-body-sm bg-white dark:bg-surface-dim dark:text-on-surface" placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="px-3 py-1.5 rounded-lg border border-outline-variant dark:border-outline text-body-sm bg-white dark:bg-surface-dim dark:text-on-surface" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="storefront" title="No products found" body="Try a different search or category." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {list.map((p: any) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <div className="h-32 bg-surface-container-low dark:bg-surface-variant flex items-center justify-center overflow-hidden">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[40px] text-on-surface-variant dark:text-surface-variant">inventory_2</span>}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h4 className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.name}</h4>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">{p.category} · {p.unit}</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.price.toLocaleString()} XAF</span>
                  <span className="text-[11px] text-on-surface-variant dark:text-surface-variant">{p.vendor}</span>
                  {p.vendorVerified && <span className="material-symbols-outlined text-[16px] text-primary dark:text-primary-fixed-dim">verified</span>}
                </div>
                <p className="text-label-md mb-2">{p.stock > 0 ? <span className="text-[#2F6B50]">In stock ({p.stock})</span> : <span className="text-error">Out of stock</span>}</p>
                <div className="mt-auto flex gap-2">
                  <button className={btnPrimary + ' flex-1'} disabled={p.stock <= 0} onClick={() => addToCart(p.id)}>Add to Cart</button>
                  <button className={btnGhost} onClick={() => favorite(p.id)} title="Save"><span className="material-symbols-outlined text-[18px]">favorite</span></button>
                  <button className={btnGhost} onClick={() => setQuoteFor(p)} title="Request quote"><span className="material-symbols-outlined text-[18px]">request_quote</span></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!quoteFor} onClose={() => setQuoteFor(null)} title={`Request Quotation — ${quoteFor?.name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Vendor: {quoteFor?.vendor}</p>
          <Field label="Message"><textarea className={inputClass} rows={3} placeholder="Quantity, delivery details…" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <button className={btnPrimary} onClick={sendQuote}>Send Request</button>
        </div>
      </Modal>
    </div>
  );
}
