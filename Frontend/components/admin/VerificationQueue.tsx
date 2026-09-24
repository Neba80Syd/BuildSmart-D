'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type QueueItem = { type: 'ARCHITECT' | 'VENDOR'; userId: string; name: string; status: string; licenseNumber?: string; experience?: number };

const statusTone: Record<string, string> = {
  PENDING: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
  VERIFIED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
  FULLY_VERIFIED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
  REJECTED: 'bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-error/20 dark:text-error-container',
  UNVERIFIED: 'bg-surface-variant text-on-surface-variant dark:bg-surface-variant dark:text-on-surface-variant',
};

export function VerificationQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/verification');
    const data = await res.json();
    setQueue(data.queue ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (item: QueueItem, decision: 'APPROVE' | 'REJECT') => {
    setBusy(item.userId + item.type);
    const res = await fetch('/api/admin/verification', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type, userId: item.userId, decision }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(`${item.name} ${decision === 'APPROVE' ? 'approved' : 'rejected'}`);
      load();
    } else toast.error('Action failed');
  };

  if (loading) return <p className="p-6 text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p>;
  if (queue.length === 0) return <p className="p-6 text-body-sm text-on-surface-variant dark:text-surface-variant">No verification submissions.</p>;

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
          <th className="py-4 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Name</th>
          <th className="py-4 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Type</th>
          <th className="py-4 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">License / Reg</th>
          <th className="py-4 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Status</th>
          <th className="py-4 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Action</th>
        </tr>
      </thead>
      <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
        {queue.map((r) => (
          <tr key={r.type + r.userId} className="border-b border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-dim transition-colors">
            <td className="py-4 px-6 font-medium">{r.name}</td>
            <td className="py-4 px-6 text-on-surface-variant dark:text-surface-variant">{r.type}</td>
            <td className="py-4 px-6 font-mono-technical text-on-surface-variant dark:text-surface-variant">{r.licenseNumber ?? '—'}</td>
            <td className="py-4 px-6">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusTone[r.status] ?? statusTone.UNVERIFIED}`}>{r.status}</span>
            </td>
            <td className="py-4 px-6">
              {r.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button onClick={() => decide(r, 'APPROVE')} disabled={busy === r.userId + r.type} className="text-[#2F6B50] dark:text-primary-fixed-dim hover:underline text-label-md disabled:opacity-50">Approve</button>
                  <button onClick={() => decide(r, 'REJECT')} disabled={busy === r.userId + r.type} className="text-error dark:text-error-container hover:underline text-label-md disabled:opacity-50">Reject</button>
                </div>
              ) : (
                <span className="text-on-surface-variant dark:text-surface-variant text-label-md">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
