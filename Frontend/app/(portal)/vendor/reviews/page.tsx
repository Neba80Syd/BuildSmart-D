'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Review = {
  id: string;
  targetId: string;
  subjectName: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  response: string | null;
  createdAt: string;
};

export default function VendorReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState({ total: 0, average: 0 });
  const [respondId, setRespondId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    const res = await fetch('/api/vendor/reviews');
    const d = await res.json();
    setReviews(d.reviews ?? []);
    setSummary(d.summary ?? { total: 0, average: 0 });
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return reviews;
    const t = q.toLowerCase();
    return reviews.filter((r) => r.authorName.toLowerCase().includes(t) || r.title.toLowerCase().includes(t) || r.body.toLowerCase().includes(t) || r.subjectName.toLowerCase().includes(t));
  }, [reviews, q]);

  const openRespond = (r: Review) => {
    setRespondId(r.id);
    setResponse(r.response ?? '');
  };

  const submitResponse = async () => {
    if (!respondId || !response.trim()) return toast.error('Response cannot be empty');
    const res = await fetch('/api/vendor/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: respondId, response }),
    });
    if (res.ok) {
      toast.success('Response published');
      setRespondId(null);
      load();
    } else toast.error('Could not publish response');
  };

  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Review Management</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Read customer ratings and publicly respond to feedback.</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-8 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 mb-6">
        <div>
          <div className="text-display text-on-background dark:text-surface-container-lowest">{summary.average.toFixed(1)}</div>
          <div className="text-[#A66A00] dark:text-[#FFB951] text-lg">{stars(summary.average)}</div>
          <div className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{summary.total} reviews</div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews…" className="input w-full max-w-sm" />
        </div>
      </div>

      {/* Review list */}
      <div className="space-y-4">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#A66A00] dark:text-[#FFB951]">{stars(r.rating)}</span>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{r.subjectName}</span>
                </div>
                <h3 className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{r.title}</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">{r.body}</p>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-2">— {r.authorName}, {new Date(r.createdAt).toLocaleDateString()}</p>
                {r.response && (
                  <div className="mt-3 ml-4 p-4 rounded-lg bg-secondary-container dark:bg-primary-container">
                    <div className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mb-1">Your response</div>
                    <p className="text-body-sm text-on-background dark:text-surface-container-lowest">{r.response}</p>
                  </div>
                )}
              </div>
              <button onClick={() => openRespond(r)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline shrink-0">
                {r.response ? 'Edit response' : 'Respond'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-body-md text-on-surface-variant dark:text-surface-variant text-center py-12">No reviews found.</p>}
      </div>

      {/* Response modal */}
      {respondId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRespondId(null)}>
          <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Public Response</h2>
            <textarea className="input w-full" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Thank your customer or address their feedback…" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRespondId(null)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Cancel</button>
              <button onClick={submitResponse} className="btn-primary px-4 py-2 rounded-lg text-label-md">Publish Response</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
