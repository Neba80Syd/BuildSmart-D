'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ArchitectReviewsPage() {
  const { data, loading, refetch } = useApi<{ reviews: any[]; summary: any }>('/api/architect/reviews');
  const [respond, setRespond] = useState<any | null>(null);

  const reviews = data?.reviews ?? [];
  const summary = data?.summary;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Reviews & Ratings" subtitle="Monitor and respond to your client reviews." crumbs={['Architect', 'Professional', 'Reviews']} />

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
      ) : reviews.length === 0 ? (
        <EmptyState icon="reviews" title="No reviews yet" body="Client reviews will appear here." />
      ) : (
        <>
          <Card className="mb-6 flex flex-col md:flex-row items-center gap-6">
            <div className="text-center">
              <p className="text-display text-[#A66A00] dark:text-yellow-400">{summary?.average ?? 0}</p>
              <div className="flex justify-center text-[#A66A00] dark:text-yellow-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{s <= Math.round(summary?.average ?? 0) ? 'star' : 'star'}</span>
                ))}
              </div>
              <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{summary?.total ?? 0} reviews</p>
            </div>
            <div className="flex-1 w-full space-y-1">
              {(summary?.distribution ?? []).map((d: any) => (
                <div key={d.star} className="flex items-center gap-2">
                  <span className="text-label-md w-8">{d.star}★</span>
                  <div className="flex-1 bg-surface-variant dark:bg-surface-container-high rounded-full h-2 overflow-hidden">
                    <div className="bg-[#A66A00] h-2 rounded-full" style={{ width: `${summary.total ? (d.count / summary.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold">{initials(r.authorName)}</div>
                    <div>
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{r.authorName}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="flex text-[#A66A00] dark:text-yellow-400">{Array.from({ length: r.rating }).map((_, i) => <span key={i} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}</span>
                </div>
                <h3 className="text-body-md font-semibold text-on-surface dark:text-inverse-on-surface">{r.title}</h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{r.body}</p>
                {r.response ? (
                  <div className="mt-3 p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant border-l-4 border-primary">
                    <p className="text-label-md text-primary dark:text-primary-fixed-dim mb-1">Your response</p>
                    <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{r.response}</p>
                  </div>
                ) : (
                  <button className={btnGhost + ' mt-3'} onClick={() => setRespond(r)}>Respond publicly</button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {respond && (
        <Modal open title="Respond to review" onClose={() => setRespond(null)}>
          <RespondForm review={respond} onDone={() => { setRespond(null); refetch(); }} />
        </Modal>
      )}
    </div>
  );
}

function RespondForm({ review, onDone }: { review: any; onDone: () => void }) {
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api('POST', '/api/architect/reviews', { id: review.id, response: fd.get('response') });
      toast.success('Response published');
      onDone();
    } catch (err: any) { toast.error(err.message); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your response"><textarea className={inputClass} name="response" rows={4} required minLength={2} /></Field>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>
        <button type="submit" className={btnPrimary}>Publish Response</button>
      </div>
    </form>
  );
}

function initials(name?: string) {
  return (name ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
