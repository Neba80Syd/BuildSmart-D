'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { ProtectedDesignViewer } from '@/Frontend/components/architect/ProtectedDesignViewer';

export default function ClientDesignsPage() {
  const { data, loading, refetch } = useApi<{ designs: any[] }>('/api/client/designs');
  const [commentFor, setCommentFor] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [inspectingDesign, setInspectingDesign] = useState<any | null>(null);

  const act = async (id: string, action: string, extra = {}) => {
    try { await api('PATCH', '/api/client/designs', { id, action, ...extra }); toast.success('Saved'); setCommentFor(null); setComment(''); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div></div>;

  const designs = data?.designs ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="My Designs" subtitle="Designs created for your projects, including generated 3D floorplans." crumbs={['Client', 'My Projects', 'My Designs']} />

      {designs.length === 0 ? (
        <EmptyState icon="collections_bookmark" title="No designs yet" body="Designs shared by your architect will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {designs.map((d) => (
            <Card key={d.id} className="flex flex-col overflow-hidden">
              <div className="h-40 bg-surface-container-low dark:bg-surface-variant flex items-center justify-center overflow-hidden">
                {d.thumbnail ? <img src={d.thumbnail} alt={d.name} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[56px] text-on-surface-variant dark:text-surface-variant">architecture</span>}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{d.name}</h3>
                  <StatusPill status={d.status} />
                </div>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-2">{d.projectName} · {d.architectName} · V{d.version}</p>
                {d.aiGenerated && <p className="text-[11px] text-[#A66A00] dark:text-yellow-500 mb-2">AI-generated draft — requires professional review.</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  {d.threeD?.length > 0 && <Link href={`/client/3d?project=${d.projectId}&plan=${d.threeD[0].id}`} className={btnGhost}><span className="material-symbols-outlined text-[16px]">view_in_ar</span>3D Floorplan</Link>}
                  {d.projectId && <Link href="/client/floorplans" className={btnGhost}><span className="material-symbols-outlined text-[16px]">edit_square</span>2D Plan</Link>}
                  <button className={btnGhost} onClick={() => setCommentFor(d)}><span className="material-symbols-outlined text-[16px]">comment</span>Comment</button>
                  <button className={btnPrimary} onClick={() => setInspectingDesign(d)}>
                    <span className="material-symbols-outlined text-[16px]">shield_locked</span>Review &amp; Escrow
                  </button>
                  {['CLIENT_REVIEW', 'REVISION'].includes(d.status) && (
                    <>
                      <button className={btnGhost} onClick={() => act(d.id, 'approve')}>Approve</button>
                      <button className={btnGhost} onClick={() => act(d.id, 'request_revision')}>Request Changes</button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!commentFor} onClose={() => setCommentFor(null)} title={`Comment on ${commentFor?.name ?? ''}`}>
        <div className="space-y-4">
          <Field label="Comment"><textarea className={inputClass} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <button className={btnPrimary} onClick={() => act(commentFor.id, 'comment', { comment })}>Send Comment</button>
        </div>
      </Modal>

      {/* Protected Escrow Review Modal */}
      {inspectingDesign && (
        <Modal
          open={!!inspectingDesign}
          onClose={() => setInspectingDesign(null)}
          title={`Deliverable Review: ${inspectingDesign.name}`}
        >
          <div className="space-y-4">
            <ProtectedDesignViewer
              designId={inspectingDesign.id}
              projectId={inspectingDesign.projectId}
              projectName={inspectingDesign.projectName || inspectingDesign.name}
              clientName="Valued Client"
              architectName={inspectingDesign.architectName || 'Architect'}
              amount={150000}
              onApprove={() => {
                act(inspectingDesign.id, 'approve');
                setInspectingDesign(null);
              }}
              onRequestRevision={(notes) => {
                act(inspectingDesign.id, 'request_revision', { notes });
                setInspectingDesign(null);
              }}
            >
              <div className="h-72 rounded-xl bg-surface-container-low dark:bg-surface-variant flex flex-col items-center justify-center overflow-hidden relative">
                {inspectingDesign.thumbnail ? (
                  <img src={inspectingDesign.thumbnail} alt={inspectingDesign.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <span className="material-symbols-outlined text-[64px] text-primary">architecture</span>
                    <p className="font-semibold text-body-md text-on-surface dark:text-inverse-on-surface">{inspectingDesign.name}</p>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant max-w-sm">
                      Full 2D plan drawings, CAD/BIM deliverables, and structural notes.
                    </p>
                  </div>
                )}
              </div>
            </ProtectedDesignViewer>
          </div>
        </Modal>
      )}
    </div>
  );
}
