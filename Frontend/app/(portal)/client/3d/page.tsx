'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { PageHeader, Card, StatusPill, EmptyState, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const BuildingScene = dynamic(() => import('@/Frontend/components/viewer/BuildingScene').then((m) => m.BuildingScene), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-on-surface-variant dark:text-surface-variant">Loading 3D viewer…</div>,
});
import { ProtectedDesignViewer } from '@/Frontend/components/architect/ProtectedDesignViewer';

const CATEGORIES = ['Room Layout', 'Room Size', 'Doors and Windows', 'Furniture Placement', 'Interior Appearance', 'Exterior Appearance', 'Materials', 'Colors', 'Lighting', 'Floor Selection', 'Circulation', 'Accessibility', 'Missing Element', 'Incorrect Element', 'General Feedback', 'Other'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const FLOORS = ['Ground Floor', 'First Floor', 'Second Floor'];

export default function Client3DPage() {
  const { data, loading } = useApi<any>('/api/client/floorplans');
  const [projectId, setProjectId] = useState('');
  const [planId, setPlanId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ floor: 'Ground Floor', area: '', category: 'General Feedback', description: '', priority: 'NORMAL' });

  const projects: any[] = data?.projects ?? [];
  const plans: any[] = (data?.floorPlans ?? []).filter((p: any) => p.kind === '3D');
  const feedback: any[] = data?.feedback ?? [];

  const activeProjectId = projectId || projects[0]?.id || '';
  const projectPlans = plans.filter((p) => p.projectId === activeProjectId);
  const activePlan = planId ? projectPlans.find((p) => p.id === planId) : projectPlans.find((p) => p.status === 'PUBLISHED') ?? projectPlans[0] ?? null;
  const planFeedback = feedback.filter((f) => f.floorPlanId === activePlan?.id);

  // Support deep links (?project=…&plan=…).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get('project'); const pl = sp.get('plan');
    if (p) setProjectId(p);
    if (pl) setPlanId(pl);
  }, []);

  const rooms: any[] = activePlan?.status === 'PUBLISHED' && Array.isArray(activePlan?.data?.rooms) ? activePlan.data.rooms : [];

  const submitFeedback = async () => {
    if (!form.description.trim()) return toast.error('Please describe your feedback');
    try {
      await api('POST', '/api/client/feedback', { floorPlanId: activePlan.id, ...form });
      setSubmitted(true); setForm({ ...form, description: '', area: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const withdraw = async (id: string) => {
    try { await api('PATCH', '/api/client/feedback', { id, action: 'withdraw' }); toast.success('Feedback withdrawn'); window.location.reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const approve = async () => {
    try { await api('POST', '/api/client/approvals', { kind: 'floorplan', id: activePlan.id, action: 'approve' }); toast.success('3D floorplan approved'); window.location.reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  const requestChanges = async () => {
    try { await api('POST', '/api/client/approvals', { kind: 'floorplan', id: activePlan.id, action: 'request_changes' }); toast.success('Revision requested'); window.location.reload(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-[480px]" /></div>;

  if (plans.length === 0) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop">
        <PageHeader title="3D Visualization" subtitle="Explore the generated 3D floorplans published by your architect." crumbs={['Client', 'Design Review', '3D Visualization']} />
        <EmptyState icon="view_in_ar" title="A 3D floorplan has not been published for this project yet" body="You will be notified when the architect completes and publishes it." />
      </div>
    );
  }

  const isGenerating = activePlan && ['GENERATING', 'PROCESSING'].includes(activePlan.status);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1600px] mx-auto">
      <PageHeader title="3D Visualization" subtitle="Explore the generated 3D floorplan and provide feedback to your architect." crumbs={['Client', 'Design Review', '3D Visualization']} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Viewer + info */}
        <div className="xl:col-span-2 space-y-4">
          <Card pad={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant dark:border-outline flex flex-wrap items-center gap-3">
              <Field label="Project"><select className={inputClass} value={activeProjectId} onChange={(e) => { setProjectId(e.target.value); setPlanId(''); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Version">
                <select className={inputClass} value={activePlan?.id ?? ''} onChange={(e) => setPlanId(e.target.value)}>
                  {projectPlans.map((p) => <option key={p.id} value={p.id}>{p.name} (V{p.version})</option>)}
                </select>
              </Field>
              {activePlan && <div className="ml-auto flex items-center gap-2"><StatusPill status={activePlan.status} /><StatusPill status={activePlan.reviewStatus} /></div>}
            </div>

            {activePlan?.id ? (
              <ProtectedDesignViewer
                designId={activePlan.id}
                projectId={activePlan.projectId}
                projectName={projects.find((p) => p.id === activePlan.projectId)?.name || activePlan.name}
                clientName="Valued Client"
                architectName={projects.find((p) => p.id === activePlan.projectId)?.architectName || 'Architect'}
                onApprove={approve}
                onRequestRevision={requestChanges}
              >
                <div className="h-[460px] bg-surface-container-low dark:bg-surface-variant/30 relative">
                  {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-surface-variant dark:text-surface-variant">
                      <span className="material-symbols-outlined text-[56px] animate-spin">progress_activity</span>
                      <p className="text-body-sm">Your architect is still preparing the 3D floorplan.</p>
                      <p className="text-label-md">You will receive a notification when it is ready for review.</p>
                    </div>
                  ) : activePlan?.status === 'PUBLISHED' && rooms.length > 0 ? (
                    <BuildingScene rooms={rooms} height={3} color="#b8c4be" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant dark:text-surface-variant">Model unavailable.</div>
                  )}
                </div>
              </ProtectedDesignViewer>
            ) : (
              <div className="h-[460px] bg-surface-container-low dark:bg-surface-variant/30 flex items-center justify-center text-on-surface-variant dark:text-surface-variant">
                Select a floor plan to review.
              </div>
            )}
          </Card>

          {activePlan?.status === 'PUBLISHED' && (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">{activePlan.name}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-body-sm">
                <Info label="Architect" value={activePlan.projectName ? projects.find((p) => p.id === activePlan.projectId)?.architectName ?? '—' : '—'} />
                <Info label="Version" value={`V${activePlan.version}`} />
                <Info label="Published" value={activePlan.publishedAt ? new Date(activePlan.publishedAt).toLocaleDateString() : '—'} />
                <Info label="Review status" value={activePlan.reviewStatus} />
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {['READY_FOR_REVIEW', 'UPDATED_READY', 'VIEWED', 'FEEDBACK_SUBMITTED'].includes(activePlan.reviewStatus) && (
                  <>
                    <button className={btnPrimary} onClick={approve}><span className="material-symbols-outlined text-[18px]">check</span>Approve Version</button>
                    <button className={btnGhost} onClick={requestChanges}><span className="material-symbols-outlined text-[18px]">construction</span>Request Modifications</button>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Feedback panel */}
        <div className="space-y-4">
          {activePlan?.status === 'PUBLISHED' ? (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Submit Feedback</h4>
              {submitted ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-secondary-container/60 dark:bg-primary-container/30">
                    <p className="text-body-sm font-semibold text-primary dark:text-primary-fixed-dim">Your feedback has been submitted to the architect.</p>
                    <p className="text-body-sm text-on-surface dark:text-inverse-on-surface mt-1">The architect will review your request and update the 3D floorplan if necessary.</p>
                  </div>
                  <button className={btnGhost} onClick={() => setSubmitted(false)}>Submit Another</button>
                  <a href={`/client/3d?project=${activePlan.projectId}&plan=${activePlan.id}`} className="btnPrimary inline-block">Return to 3D Floorplan</a>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Floor"><select className={inputClass} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>{FLOORS.map((f) => <option key={f}>{f}</option>)}</select></Field>
                    <Field label="Room / Area"><input className={inputClass} value={form.area} placeholder="e.g. Kitchen" onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
                  </div>
                  <Field label="Category"><select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="Priority"><select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
                  <Field label="Description"><textarea className={inputClass} rows={3} placeholder="Describe the requested change…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                  <button className={btnPrimary + ' w-full'} onClick={submitFeedback}>Submit Feedback</button>
                  <p className="text-[11px] text-on-surface-variant dark:text-surface-variant">You are submitting a review request — you cannot modify the 3D model directly.</p>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">Feedback</h4>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Feedback becomes available once the 3D floorplan is published.</p>
            </Card>
          )}

          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Your Feedback History</h4>
            {planFeedback.length === 0 ? (
              <EmptyState icon="rate_review" title="No feedback for this 3D floorplan yet" body="Review the model and let your architect know what you would like changed." />
            ) : (
              <div className="space-y-3">
                {planFeedback.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div className="flex items-center justify-between mb-1"><span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{f.category}</span><StatusPill status={f.status} /></div>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">{f.floor} · {f.area} · {f.priority}</p>
                    <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{f.description}</p>
                    {f.architectResponse && (
                      <div className="mt-2 p-2 rounded bg-secondary-container/50 dark:bg-primary-container/30">
                        <p className="text-label-md text-primary dark:text-primary-fixed-dim font-semibold">Architect response</p>
                        <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{f.architectResponse}</p>
                      </div>
                    )}
                    {['SUBMITTED', 'RECEIVED'].includes(f.status) && <button className="text-label-md text-error mt-2" onClick={() => withdraw(f.id)}>Withdraw</button>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{label}</p>
      <p className="text-on-surface dark:text-inverse-on-surface">{value}</p>
    </div>
  );
}
