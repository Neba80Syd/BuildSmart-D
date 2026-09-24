'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StatusPill } from '@/Frontend/components/vendor/charts';

const fmt = (n: number) => Math.round(n).toLocaleString();

type Return = {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  reason: string;
  items: { productId: string; quantity: number; unitPrice: number; total: number }[];
  status: string;
  resolutionNote: string | null;
  requestedAt: string;
};

export default function VendorReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [resolveTarget, setResolveTarget] = useState<Return | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | 'REFUND'>('APPROVE');
  const [note, setNote] = useState('');

  const load = async () => {
    const res = await fetch('/api/vendor/returns');
    const data = await res.json();
    setReturns(data.returns ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const submitResolution = async () => {
    if (!resolveTarget) return;
    const res = await fetch('/api/vendor/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resolveTarget.id, decision, note }),
    });
    if (res.ok) {
      toast.success('Return request processed');
      setResolveTarget(null);
      setNote('');
      load();
    } else toast.error('Could not process return');
  };

  const counts = {
    REQUESTED: returns.filter((r) => r.status === 'REQUESTED').length,
    APPROVED: returns.filter((r) => r.status === 'APPROVED').length,
    REFUNDED: returns.filter((r) => r.status === 'REFUNDED').length,
    REJECTED: returns.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Returns &amp; Refunds</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Approve, reject, or process customer return requests.</p>
      </div>

      {/* Queue summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-xl">
        {[['REQUESTED', 'Awaiting action'], ['APPROVED', 'Approved'], ['REFUNDED', 'Refunded'], ['REJECTED', 'Rejected']].map(([k, l]) => (
          <div key={k} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5">
            <div className="text-display text-on-background dark:text-surface-container-lowest">{counts[k as keyof typeof counts]}</div>
            <div className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Request</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Customer</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Reason</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Value</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Status</th>
                <th className="py-3 px-6 text-right text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-dim transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-mono-technical text-primary dark:text-primary-fixed-dim">{r.id.slice(0, 10).toUpperCase()}</div>
                    <div className="text-label-md text-on-surface-variant dark:text-surface-variant">Order {r.orderId.slice(0, 10).toUpperCase()} · {new Date(r.requestedAt).toLocaleDateString()}</div>
                  </td>
                  <td className="py-4 px-6 font-semibold">{r.customerName}</td>
                  <td className="py-4 px-6 max-w-xs">{r.reason}</td>
                  <td className="py-4 px-6 font-mono-technical">{fmt((r.items ?? []).reduce((s: number, i) => s + i.total, 0))}</td>
                  <td className="py-4 px-6"><StatusPill status={r.status} /></td>
                  <td className="py-4 px-6 text-right">
                    {r.status === 'REQUESTED' ? (
                      <button onClick={() => { setResolveTarget(r); setDecision('APPROVE'); }} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Review</button>
                    ) : (
                      <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{r.resolutionNote ? 'Resolved' : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
              {returns.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant dark:text-surface-variant">No return requests.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolution modal */}
      {resolveTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setResolveTarget(null)}>
          <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-1">Resolve Return</h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">{resolveTarget.customerName} — {resolveTarget.reason}</p>
            <div className="space-y-2 mb-4">
              {resolveTarget.items.map((it, i) => (
                <div key={i} className="flex justify-between text-body-sm border-b border-outline-variant/50 pb-1">
                  <span>× {it.quantity} item</span>
                  <span className="font-mono-technical">{fmt(it.total)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              {(['APPROVE', 'REFUND', 'REJECT'] as const).map((d) => (
                <button key={d} onClick={() => setDecision(d)} className={`px-4 py-2 rounded-lg text-label-md border transition-colors ${decision === d ? 'bg-primary text-white border-primary' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>
                  {d}
                </button>
              ))}
            </div>
            <label className="block mb-4">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Resolution note (optional)</span>
              <textarea className="input w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Refund to be issued within 5 business days." />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setResolveTarget(null)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Cancel</button>
              <button onClick={submitResolution} className="btn-primary px-4 py-2 rounded-lg text-label-md">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
