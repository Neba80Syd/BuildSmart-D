'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Skeleton, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();
const CATS = ['Structural', 'Roofing', 'Finishing', 'Openings', 'Plumbing', 'Electrical'];

export default function ClientBoqPage() {
  const { data, loading, refetch } = useApi<{ boqs: any[]; projects: any[] }>('/api/client/boq');
  const [active, setActive] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [askFor, setAskFor] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const boqs = data?.boqs ?? [];
  const activeBoq = boqs.find((b) => b.id === active) ?? boqs[0] ?? null;

  const items = useMemo(() => {
    if (!activeBoq) return [];
    return (activeBoq.items ?? []).filter((i: any) => (cat ? i.category === cat : true)).filter((i: any) => (q ? (i.material + ' ' + (i.description ?? '')).toLowerCase().includes(q.toLowerCase()) : true));
  }, [activeBoq, cat, q]);

  const askUpdate = async () => {
    try { await api('POST', '/api/client/boq', { boqId: activeBoq.id, message: msg }); toast.success('Update request sent to architect'); setAskFor(null); setMsg(''); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  if (boqs.length === 0) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop">
        <PageHeader title="Estimates & BOQs" subtitle="Material estimates and bills of quantities prepared by your architect." crumbs={['Client', 'Materials', 'Estimates & BOQs']} />
        <EmptyState icon="request_quote" title="No BOQs yet" body="Your architect will prepare a bill of quantities for your project." />
      </div>
    );
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1300px] mx-auto">
      <PageHeader title="Estimates & BOQs" subtitle="Material estimates and bills of quantities prepared by your architect." crumbs={['Client', 'Materials', 'Estimates & BOQs']} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-4">
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-on-surface mb-2">Documents</h4>
            <div className="space-y-1">
              {boqs.map((b) => (
                <button key={b.id} onClick={() => setActive(b.id)} className={`w-full text-left px-3 py-2 rounded-lg text-body-sm ${activeBoq?.id === b.id ? 'bg-secondary-container dark:bg-primary-container text-primary font-semibold' : 'hover:bg-surface-container-low dark:hover:bg-surface-variant text-on-surface dark:text-on-surface'}`}>
                  {b.name} <span className="text-label-md">V{b.version}</span>
                  <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{b.projectName}</div>
                </button>
              ))}
            </div>
          </Card>
          {activeBoq && (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-on-surface mb-2">Summary</h4>
              <div className="space-y-1 text-body-sm text-on-surface dark:text-on-surface">
                <p className="flex justify-between"><span>Status</span><StatusPill status={activeBoq.status} /></p>
                <p className="flex justify-between"><span>Line items</span><span>{activeBoq.items.length}</span></p>
                <p className="flex justify-between"><span>AI-estimated</span><span>{activeBoq.aiCount}</span></p>
                <p className="flex justify-between font-semibold border-t border-outline-variant/50 dark:border-outline/40 pt-2"><span>Total</span><span>{fmt(activeBoq.total)} XAF</span></p>
              </div>
              <button className={btnGhost + ' w-full mt-3'} onClick={() => setAskFor(activeBoq)}><span className="material-symbols-outlined text-[16px]">refresh</span>Request Updated Estimate</button>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3">
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant dark:border-outline flex flex-wrap items-center gap-3">
              <select className={inputClass} value={cat} onChange={(e) => setCat(e.target.value)}>{<option value="">All categories</option>}{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <input className={inputClass + ' flex-1 min-w-[160px]'} placeholder="Search materials…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <table className="w-full text-body-sm">
              <thead><tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant/50 dark:border-outline/40">
                <th className="px-4 py-2">Material</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2">Unit price</th><th className="px-4 py-2">Total</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.id} className="border-b border-outline-variant/30 dark:border-outline/30">
                    <td className="px-4 py-2 text-on-surface dark:text-on-surface">{i.material}{i.source === 'AI_ESTIMATE' && <span className="ml-1 text-[10px] text-[#A66A00] dark:text-yellow-500">ESTIMATE</span>}</td>
                    <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{i.category}</td>
                    <td className="px-4 py-2 text-on-surface dark:text-on-surface">{i.quantity}</td>
                    <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{i.unit}</td>
                    <td className="px-4 py-2 text-on-surface dark:text-on-surface">{fmt(i.unitPrice)}</td>
                    <td className="px-4 py-2 font-semibold text-on-surface dark:text-on-surface">{fmt(i.total)}</td>
                    <td className="px-4 py-2">{i.linkedProductId && <Link href="/client/marketplace" className="text-primary dark:text-primary-fixed-dim text-label-md">Buy →</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="p-6"><EmptyState icon="search_off" title="No matching items" /></div>}
          </Card>
          <p className="text-[11px] text-on-surface-variant dark:text-surface-variant mt-2">AI-generated quantities are estimates and require professional review before procurement.</p>
        </div>
      </div>

      {askFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAskFor(null)}>
          <div className="bg-white dark:bg-surface-dim rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-headline-sm text-on-surface dark:text-on-surface mb-3">Request Updated Estimate</h3>
            <textarea className={inputClass} rows={3} placeholder="Tell the architect what changed…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <div className="flex gap-2 mt-4"><button className={btnGhost} onClick={() => setAskFor(null)}>Cancel</button><button className={btnPrimary} onClick={askUpdate}>Send Request</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
