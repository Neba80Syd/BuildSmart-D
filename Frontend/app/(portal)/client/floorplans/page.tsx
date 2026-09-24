'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const S = 40; // px per meter

export default function ClientFloorPlansPage() {
  const { data, loading } = useApi<any>('/api/client/floorplans?kind=2D');
  const [projectId, setProjectId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [askFor, setAskFor] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const projects: any[] = data?.projects ?? [];
  const plans: any[] = (data?.floorPlans ?? []).filter((p: any) => p.kind === '2D');
  const activeId = projectId || projects[0]?.id || '';
  const plan = plans.find((p) => p.projectId === activeId) ?? plans[0] ?? null;

  const rooms: any[] = Array.isArray(plan?.data?.rooms) ? plan.data.rooms : [];

  const sendReview = async (action: 'ask' | 'request_change') => {
    try { await api('POST', '/api/client/floorplans', { planId: plan.id, action, message: msg, area: '' }); toast.success(action === 'ask' ? 'Question sent to architect' : 'Change request sent'); setAskFor(null); setMsg(''); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96" /></div>;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1500px] mx-auto">
      <PageHeader title="2D Floor Plans" subtitle="Review your architect's published floor plans. You can zoom, pan and request changes." crumbs={['Client', 'Design Review', '2D Floor Plans']}
        actions={<button className={btnGhost} onClick={() => setFullscreen(!fullscreen)}><span className="material-symbols-outlined text-[18px]">{fullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>{fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>} />

      {plans.length === 0 ? (
        <EmptyState icon="edit_square" title="No published 2D floor plans yet" body="Your architect will publish plans here for your review." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-4">
            <Card>
              <Field label="Project">
                <select className={inputClass} value={activeId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </Card>
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">Plans</h4>
              <div className="space-y-1">
                {plans.map((p) => (
                  <button key={p.id} onClick={() => setProjectId(p.projectId)} className={`w-full text-left px-3 py-2 rounded-lg text-body-sm ${plan?.id === p.id ? 'bg-secondary-container dark:bg-primary-container text-primary font-semibold' : 'hover:bg-surface-container-low dark:hover:bg-surface-variant text-on-surface dark:text-inverse-on-surface'}`}>
                    {p.name} <span className="text-label-md">V{p.version}</span>
                  </button>
                ))}
              </div>
            </Card>
            {plan && (
              <Card>
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">Rooms</h4>
                <div className="space-y-1 text-body-sm text-on-surface dark:text-inverse-on-surface">
                  {rooms.map((r) => <div key={r.id} className="flex justify-between"><span>{r.name}</span><span className="text-on-surface-variant dark:text-surface-variant">{((r.w ?? 0) * (r.h ?? 0)).toFixed(1)} m²</span></div>)}
                </div>
              </Card>
            )}
            {plan && (
              <Card>
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">Review</h4>
                <div className="flex flex-col gap-2">
                  <button className={btnGhost} onClick={() => setAskFor('ask')}><span className="material-symbols-outlined text-[18px]">help</span>Ask a Question</button>
                  <button className={btnPrimary} onClick={() => setAskFor('request_change')}><span className="material-symbols-outlined text-[18px]">construction</span>Request Changes</button>
                </div>
              </Card>
            )}
          </div>

          <div className={`lg:col-span-3 ${fullscreen ? 'fixed inset-0 z-50 bg-[#FAFAF8] dark:bg-[#17201e] p-4' : ''}`}>
            <Card pad={false} className="overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant dark:border-outline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">floorplan</span>
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{plan?.name}</h3>
                  {plan && <StatusPill status={plan.reviewStatus} />}
                </div>
                <div className="flex items-center gap-2">
                  <button className={btnGhost} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>−</button>
                  <span className="text-label-md">{Math.round(zoom * 100)}%</span>
                  <button className={btnGhost} onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>+</button>
                </div>
              </div>
              <div className="p-6 overflow-auto bg-surface-container-low/40 dark:bg-surface-variant/20 min-h-[480px]">
                {plan?.svgData && (plan.svgData.startsWith('/') || plan.svgData.startsWith('http') || plan.svgData.startsWith('data:')) ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="mb-4 px-3 py-1 rounded-full bg-emerald-50 dark:bg-primary-container/20 border border-emerald-200 dark:border-primary text-emerald-800 dark:text-emerald-200 text-label-sm font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      AI-generated floor plan visualization · Architect verified
                    </div>
                    <div className="overflow-hidden rounded-xl border border-outline-variant max-h-[560px] flex items-center justify-center bg-black/5">
                      <img
                        src={plan.svgData}
                        alt={plan.name}
                        className="max-h-[520px] object-contain transition-transform"
                        style={{ transform: `scale(${zoom})` }}
                      />
                    </div>
                  </div>
                ) : (
                  <svg viewBox={`0 0 ${24 * S * zoom} ${16 * S * zoom}`} className="mx-auto" style={{ width: 24 * S * zoom, height: 16 * S * zoom }}>
                    <rect x="0" y="0" width={24 * S} height={16 * S} fill="#ffffff" stroke="#cbd5d1" strokeWidth={2 / zoom} />
                    {rooms.map((r) => (
                      <g key={r.id}>
                        <rect x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill="#e7efe9" stroke="#315C4C" strokeWidth={2 / zoom} />
                        <text x={r.x * S + (r.w * S) / 2} y={r.y * S + (r.h * S) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={14 / zoom} fill="#17201e">{r.name}</text>
                        <text x={r.x * S + (r.w * S) / 2} y={r.y * S + (r.h * S) / 2 + 18 / zoom} textAnchor="middle" fontSize={11 / zoom} fill="#5b6b66">{((r.w ?? 0) * (r.h ?? 0)).toFixed(1)} m²</text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {askFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAskFor(null)}>
          <div className="bg-white dark:bg-surface-dim rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">{askFor === 'ask' ? 'Ask a Question' : 'Request Changes'}</h3>
            <textarea className={inputClass} rows={3} placeholder="Describe your question or the change you would like…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <div className="flex gap-2 mt-4"><button className={btnGhost} onClick={() => setAskFor(null)}>Cancel</button><button className={btnPrimary} onClick={() => sendReview(askFor)}>Send</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
