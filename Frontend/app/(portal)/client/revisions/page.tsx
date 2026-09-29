'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientRevisionsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/approvals');
  const [questionFor, setQuestionFor] = useState<any>(null);
  const [comments, setComments] = useState('');

  const decide = async (kind: string, id: string, action: string, extra = {}) => {
    try { await api('POST', '/api/client/approvals', { kind, id, action, ...extra }); toast.success(action.replace('_', ' ')); setQuestionFor(null); setComments(''); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const designs = data?.reviewableDesigns ?? [];
  const plans = data?.reviewablePlans ?? [];
  const feedbackByPlan = data?.feedbackByPlan ?? {};

  const total = designs.length + plans.length;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Revisions & Approvals" subtitle="A structured process to review designs and 3D floorplans before approving." crumbs={['Client', 'Design Review', 'Revisions & Approvals']} />

      {total === 0 ? (
        <EmptyState icon="fact_check" title="Nothing awaiting your review" body="You're all caught up — new submissions will appear here." />
      ) : (
        <div className="space-y-4">
          {designs.map((d: any) => (
            <Card key={`d-${d.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Design V{d.version}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-1">{d.name} · {d.projectName}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Status: {d.status}</p>
                </div>
                <StatusPill status={d.status} />
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className={btnPrimary} onClick={() => decide('design', d.id, 'approve')}>Approve</button>
                <button className={btnGhost} onClick={() => decide('design', d.id, 'request_changes')}>Request Changes</button>
                <button className={btnGhost} onClick={() => setQuestionFor({ kind: 'design', id: d.id, name: d.name })}>Ask Question</button>
                {d.thumbnail && <img src={d.thumbnail} alt="" className="h-10 w-14 object-cover rounded" />}
              </div>
            </Card>
          ))}

          {plans.map((p: any) => {
            const fb = feedbackByPlan[p.id] ?? [];
            return (
              <Card key={`p-${p.id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">3D Floorplan V{p.version}</h3>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-1">{p.name} · {p.projectName}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Published {new Date(p.publishedAt).toLocaleDateString()}</p>
                  </div>
                  <StatusPill status={p.status} />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/client/3d?project=${p.projectId}&plan=${p.id}`} className={btnGhost}><span className="material-symbols-outlined text-[18px]">view_in_ar</span>Open 3D Floorplan</Link>
                    <button className={btnPrimary} onClick={() => decide('floorplan', p.id, 'approve')}>Approve</button>
                    <button className={btnGhost} onClick={() => decide('floorplan', p.id, 'request_changes')}>Request Modifications</button>
                    <button className={btnGhost} onClick={() => setQuestionFor({ kind: 'floorplan', id: p.id, name: p.name })}>Ask Question</button>
                  </div>
                  {fb.length > 0 && (
                    <div className="border-t border-outline-variant/50 dark:border-outline/40 pt-2">
                      <p className="text-label-md font-semibold text-on-surface-variant dark:text-surface-variant mb-1">Your feedback</p>
                      {fb.map((f: any) => (
                        <div key={f.id} className="text-body-sm text-on-surface dark:text-inverse-on-surface flex items-center justify-between py-1">
                          <span>{f.category} — {f.description.slice(0, 50)}…</span><StatusPill status={f.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {questionFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQuestionFor(null)}>
          <div className="bg-white dark:bg-surface-dim rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Ask the Architect</h3>
            <Field label="Question"><textarea className={inputClass} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
            <div className="flex gap-2 mt-4"><button className={btnGhost} onClick={() => setQuestionFor(null)}>Cancel</button><button className={btnPrimary} onClick={() => decide(questionFor.kind, questionFor.id, 'ask_question', { comments })}>Send</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
