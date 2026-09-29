'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  PageHeader,
  Card,
  StatusPill,
  EmptyState,
  Field,
  inputClass,
  btnPrimary,
  btnGhost,
  Skeleton,
} from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const S = 40; // px per meter

export default function ClientFloorPlansPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/floorplans');
  const [projectId, setProjectId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [filterKind, setFilterKind] = useState<'ALL' | '2D' | '3D'>('ALL');
  const [viewMode, setViewMode] = useState<'single' | 'split'>('single');
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [askFor, setAskFor] = useState<'ask' | 'request_change' | null>(null);
  const [msg, setMsg] = useState('');
  const [show3dSource, setShow3dSource] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Read URL search params for deep linking (?project=...&plan=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get('project');
    const pl = sp.get('plan');
    if (p) setProjectId(p);
    if (pl) setSelectedPlanId(pl);
  }, []);

  const projects: any[] = data?.projects ?? [];
  const allPlans: any[] = data?.floorPlans ?? [];

  const activeProjectId = projectId || projects[0]?.id || '';
  const currentProject = projects.find((p) => p.id === activeProjectId);

  // Plans belonging to current project
  const projectPlans = useMemo(() => {
    return allPlans.filter((p) => p.projectId === activeProjectId);
  }, [allPlans, activeProjectId]);

  // Filtered by deliverable type (All, 2D, 3D)
  const filteredPlans = useMemo(() => {
    if (filterKind === 'ALL') return projectPlans;
    return projectPlans.filter((p) => p.kind === filterKind);
  }, [projectPlans, filterKind]);

  // Identify active plan
  const plan = useMemo(() => {
    if (selectedPlanId) {
      const match = projectPlans.find((p) => p.id === selectedPlanId);
      if (match) return match;
    }
    return filteredPlans[0] ?? projectPlans[0] ?? null;
  }, [projectPlans, filteredPlans, selectedPlanId]);

  // For split view: locate a paired 2D and 3D plan from the same project
  const paired2DPlan = useMemo(() => {
    if (plan?.kind === '2D') return plan;
    return projectPlans.find((p) => p.kind === '2D') ?? null;
  }, [plan, projectPlans]);

  const paired3DPlan = useMemo(() => {
    if (plan?.kind === '3D') return plan;
    return projectPlans.find((p) => p.kind === '3D') ?? null;
  }, [plan, projectPlans]);

  const hasBoth2DAnd3D = Boolean(paired2DPlan && paired3DPlan);

  const rooms: any[] = Array.isArray(plan?.data?.rooms) ? plan.data.rooms : [];

  // Review & Approval Actions
  const handleApprove = async (planToApprove = plan) => {
    if (!planToApprove) return;
    try {
      setActionLoading(true);
      await api('POST', '/api/client/approvals', {
        kind: 'floorplan',
        id: planToApprove.id,
        action: 'approve',
      });
      toast.success(`${planToApprove.kind} floor plan approved successfully!`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve plan');
    } finally {
      setActionLoading(false);
    }
  };

  const sendReview = async (action: 'ask' | 'request_change') => {
    if (!plan) return;
    if (!msg.trim()) return toast.error('Please enter a message');

    try {
      setActionLoading(true);
      if (action === 'request_change') {
        await api('POST', '/api/client/approvals', {
          kind: 'floorplan',
          id: plan.id,
          action: 'request_changes',
          comments: msg,
        });
        toast.success('Modification request submitted to architect');
      } else {
        await api('POST', '/api/client/floorplans', {
          planId: plan.id,
          action: 'ask',
          message: msg,
          area: '',
        });
        toast.success('Question sent to architect');
      }
      setAskFor(null);
      setMsg('');
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadAsset = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}`;
    a.target = '_blank';
    a.click();
  };

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop space-y-4 max-w-[1500px] mx-auto">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const renderVisualizerContent = (activeP: any, customZoom = zoom) => {
    if (!activeP) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-on-surface-variant dark:text-surface-variant">
          <span className="material-symbols-outlined text-[48px] opacity-40">floorplan</span>
          <p className="mt-2 text-body-sm font-medium">Select a floor plan to visualize</p>
        </div>
      );
    }

    const isImage =
      activeP.svgData &&
      (activeP.svgData.startsWith('/') ||
        activeP.svgData.startsWith('http') ||
        activeP.svgData.startsWith('data:'));
    const is3D = activeP.kind === '3D';
    const inputUrl = activeP?.data?.inputUrl;
    const displaySrc = is3D && show3dSource && inputUrl ? inputUrl : (activeP.svgData || activeP?.data?.imageUrl);

    if (isImage || (is3D && displaySrc)) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full relative">
          <div className="w-full overflow-hidden rounded-xl border border-outline-variant/60 dark:border-outline/40 flex items-center justify-center bg-black/5 dark:bg-black/20 min-h-[460px] p-4">
            <img
              src={displaySrc}
              alt={activeP.name}
              className="max-h-[500px] max-w-full object-contain rounded transition-transform duration-200"
              style={{ transform: `scale(${customZoom})` }}
            />
          </div>
        </div>
      );
    }

    // CAD Vector rooms layout
    const planRooms = Array.isArray(activeP?.data?.rooms) ? activeP.data.rooms : [];
    return (
      <div className="w-full flex items-center justify-center overflow-auto p-4 min-h-[460px] bg-surface-container-lowest dark:bg-surface-variant/10 rounded-xl border border-outline-variant/50">
        <svg
          viewBox={`0 0 ${24 * S * customZoom} ${16 * S * customZoom}`}
          className="mx-auto transition-transform"
          style={{ width: 24 * S * customZoom, height: 16 * S * customZoom }}
        >
          <rect
            x="0"
            y="0"
            width={24 * S}
            height={16 * S}
            fill="#ffffff"
            stroke="#cbd5d1"
            strokeWidth={2 / customZoom}
          />
          {planRooms.map((r: any) => (
            <g key={r.id}>
              <rect
                x={r.x * S}
                y={r.y * S}
                width={r.w * S}
                height={r.h * S}
                fill="#e7efe9"
                stroke="#315C4C"
                strokeWidth={2 / customZoom}
              />
              <text
                x={r.x * S + (r.w * S) / 2}
                y={r.y * S + (r.h * S) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14 / customZoom}
                fill="#17201e"
                fontWeight={600}
              >
                {r.name}
              </text>
              <text
                x={r.x * S + (r.w * S) / 2}
                y={r.y * S + (r.h * S) / 2 + 18 / customZoom}
                textAnchor="middle"
                fontSize={11 / customZoom}
                fill="#5b6b66"
              >
                {((r.w ?? 0) * (r.h ?? 0)).toFixed(1)} m²
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1500px] mx-auto space-y-6">
      <PageHeader
        title="Floor Plans & 3D Visualizations"
        subtitle="Review, inspect, and approve your architect's 2D blueprints and 3D spatial renders generated with Roomagen AI."
        crumbs={['Client', 'Design Review', 'Floor Plans & 3D']}
        actions={
          <div className="flex items-center gap-2">
            {hasBoth2DAnd3D && (
              <div className="flex items-center rounded-lg bg-surface-container-low dark:bg-surface-variant p-0.5 border border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1.5 rounded-md text-label-sm font-medium transition-all ${
                    viewMode === 'single'
                      ? 'bg-surface dark:bg-surface-container text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Focused View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 rounded-md text-label-sm font-medium flex items-center gap-1 transition-all ${
                    viewMode === 'split'
                      ? 'bg-surface dark:bg-surface-container text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  title="View 2D Blueprint and 3D Visualization side-by-side"
                >
                  <span className="material-symbols-outlined text-[15px]">splitscreen</span>
                  2D / 3D Split View
                </button>
              </div>
            )}
            <button
              className={btnGhost}
              onClick={() => setFullscreen(!fullscreen)}
            >
              <span className="material-symbols-outlined text-[18px]">
                {fullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
              {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        }
      />

      {projectPlans.length === 0 ? (
        <EmptyState
          icon="floorplan"
          title="No published floor plans yet"
          body="Your architect will generate and publish 2D blueprints and 3D visualizations here for your review and approval."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Project Selector, Deliverables List, and Plan Details */}
          <div className="space-y-4">
            {/* Project Picker */}
            <Card>
              <Field label="Project">
                <select
                  className={inputClass}
                  value={activeProjectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSelectedPlanId('');
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {currentProject && (
                <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between text-label-sm text-on-surface-variant">
                  <span>Architect:</span>
                  <span className="font-semibold text-on-surface">
                    {currentProject.architectName || 'Elena Voss'}
                  </span>
                </div>
              )}
            </Card>

            {/* Deliverables List with Kind Filter */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">
                  Deliverables
                </h4>
                <span className="text-label-sm text-on-surface-variant font-mono">
                  {projectPlans.length} total
                </span>
              </div>

              {/* Tabs: All / 2D / 3D */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-surface-container-low dark:bg-surface-variant/40 rounded-lg mb-3 text-center text-label-sm font-medium">
                <button
                  type="button"
                  onClick={() => setFilterKind('ALL')}
                  className={`py-1 rounded ${
                    filterKind === 'ALL'
                      ? 'bg-surface dark:bg-surface-container font-semibold text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  All ({projectPlans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKind('2D')}
                  className={`py-1 rounded ${
                    filterKind === '2D'
                      ? 'bg-surface dark:bg-surface-container font-semibold text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  2D ({projectPlans.filter((p) => p.kind === '2D').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKind('3D')}
                  className={`py-1 rounded ${
                    filterKind === '3D'
                      ? 'bg-surface dark:bg-surface-container font-semibold text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  3D ({projectPlans.filter((p) => p.kind === '3D').length})
                </button>
              </div>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredPlans.map((p) => {
                  const isSelected = plan?.id === p.id;
                  const is3d = p.kind === '3D';
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`w-full text-left p-2.5 rounded-lg text-body-sm transition-all border ${
                        isSelected
                          ? 'bg-secondary-container/80 dark:bg-primary-container/30 border-primary/40 text-primary font-semibold shadow-xs'
                          : 'hover:bg-surface-container-low dark:hover:bg-surface-variant/60 border-transparent text-on-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="flex items-center gap-1.5 font-medium truncate">
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              is3d ? 'text-amber-500' : 'text-teal-600'
                            }`}
                          >
                            {is3d ? 'view_in_ar' : 'floorplan'}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-container-high/60 shrink-0">
                          {p.kind} · V{p.version}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : 'Delivered'}</span>
                        <span
                          className={`font-semibold ${
                            p.reviewStatus === 'APPROVED'
                              ? 'text-emerald-600'
                              : p.reviewStatus === 'REVISION_REQUESTED'
                              ? 'text-amber-600'
                              : 'text-primary'
                          }`}
                        >
                          {p.reviewStatus || 'Ready for Review'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Room breakdown or Model metadata */}
            {plan && (
              <Card>
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2">
                  {rooms.length > 0 ? 'Room Metrics' : 'Deliverable Specs'}
                </h4>
                {rooms.length > 0 ? (
                  <div className="space-y-1.5 text-body-sm text-on-surface">
                    {rooms.map((r: any) => (
                      <div key={r.id} className="flex justify-between items-center py-0.5 border-b border-outline-variant/30 last:border-0">
                        <span>{r.name}</span>
                        <span className="text-on-surface-variant font-mono">
                          {((r.w ?? 0) * (r.h ?? 0)).toFixed(1)} m²
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between font-semibold text-primary">
                      <span>Total Measured</span>
                      <span>
                        {rooms
                          .reduce((acc: number, r: any) => acc + (r.w ?? 0) * (r.h ?? 0), 0)
                          .toFixed(1)}{' '}
                        m²
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-label-sm text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="font-semibold text-on-surface">
                        {plan.kind === '3D' ? '3D Perspective Render' : 'Vector Floor Plan'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Engine</span>
                      <span className="font-semibold text-on-surface">
                        Roomagen Architectural AI
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Version</span>
                      <span className="font-semibold text-on-surface">V{plan.version}</span>
                    </div>
                    {plan.kind === '3D' && (
                      <div className="mt-3 pt-2 border-t border-outline-variant/40">
                        <Link
                          href={`/client/3d?project=${plan.projectId}&plan=${plan.id}`}
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-medium text-xs transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
                          Open in 3D Scene View
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Review & Approvals Action Card */}
            {plan && (
              <Card className="border-teal-500/20 bg-teal-50/30 dark:bg-teal-950/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">
                    Client Review
                  </h4>
                  <StatusPill status={plan.reviewStatus} />
                </div>
                <p className="text-label-sm text-on-surface-variant mb-4">
                  Confirm the architectural layout or request revisions directly from your architect.
                </p>
                <div className="flex flex-col gap-2">
                  {plan.reviewStatus !== 'APPROVED' ? (
                    <button
                      className={btnPrimary + ' w-full justify-center'}
                      disabled={actionLoading}
                      onClick={() => handleApprove(plan)}
                    >
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Approve Floor Plan
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-body-sm font-semibold flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Plan Approved by You
                    </div>
                  )}
                  <button
                    className={btnGhost + ' w-full justify-center'}
                    disabled={actionLoading}
                    onClick={() => setAskFor('request_change')}
                  >
                    <span className="material-symbols-outlined text-[18px]">construction</span>
                    Request Modifications
                  </button>
                  <button
                    className={btnGhost + ' w-full justify-center'}
                    disabled={actionLoading}
                    onClick={() => setAskFor('ask')}
                  >
                    <span className="material-symbols-outlined text-[18px]">help</span>
                    Ask Architect a Question
                  </button>
                </div>
              </Card>
            )}
          </div>

          {/* Right Main Column: Interactive Visualizer Canvas (Single or Split Mode) */}
          <div
            className={`lg:col-span-3 ${
              fullscreen ? 'fixed inset-0 z-50 bg-[#FAFAF8] dark:bg-[#17201e] p-6 overflow-auto' : ''
            }`}
          >
            {viewMode === 'split' && hasBoth2DAnd3D ? (
              /* Split View: 2D Blueprint + 3D Render Side-by-Side */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-surface dark:bg-surface-container p-3 rounded-xl border border-outline-variant/60 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">splitscreen</span>
                    <div>
                      <h3 className="text-body-sm font-semibold text-on-surface">
                        Split Spatial Comparison: 2D Blueprint & 3D Visualization
                      </h3>
                      <p className="text-[12px] text-on-surface-variant">
                        Compare structural layout with generated photorealistic spatial render.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={btnGhost}
                      onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                    >
                      −
                    </button>
                    <span className="text-label-sm font-mono">{Math.round(zoom * 100)}%</span>
                    <button
                      className={btnGhost}
                      onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}
                    >
                      +
                    </button>
                    <button className={btnGhost} onClick={() => setZoom(1)}>
                      100%
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: 2D Blueprint */}
                  <Card pad={false} className="overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface-container-low dark:bg-surface-variant/40 border-b border-outline-variant/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-teal-600 text-[18px]">floorplan</span>
                        <span className="font-semibold text-body-sm text-on-surface">
                          {paired2DPlan?.name} (2D Blueprint)
                        </span>
                      </div>
                      {paired2DPlan && <StatusPill status={paired2DPlan.reviewStatus} />}
                    </div>
                    <div className="p-4 bg-surface-container-low/40 dark:bg-surface-variant/20 min-h-[460px] flex items-center justify-center">
                      {renderVisualizerContent(paired2DPlan, zoom)}
                    </div>
                  </Card>

                  {/* Right: 3D Visualization */}
                  <Card pad={false} className="overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface-container-low dark:bg-surface-variant/40 border-b border-outline-variant/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[18px]">view_in_ar</span>
                        <span className="font-semibold text-body-sm text-on-surface">
                          {paired3DPlan?.name} (3D Render)
                        </span>
                      </div>
                      {paired3DPlan && <StatusPill status={paired3DPlan.reviewStatus} />}
                    </div>
                    <div className="p-4 bg-surface-container-low/40 dark:bg-surface-variant/20 min-h-[460px] flex items-center justify-center">
                      {renderVisualizerContent(paired3DPlan, zoom)}
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              /* Single Focused Visualizer */
              <Card pad={false} className="overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant dark:border-outline flex flex-wrap items-center justify-between gap-3 bg-surface/50 dark:bg-surface-container/30">
                  <div className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[24px] ${
                        plan?.kind === '3D' ? 'text-amber-500' : 'text-primary'
                      }`}
                    >
                      {plan?.kind === '3D' ? 'view_in_ar' : 'floorplan'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface font-semibold">
                          {plan?.name}
                        </h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface">
                          {plan?.kind} · V{plan?.version}
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant">
                        Published by {currentProject?.architectName || 'Architect'}
                        {plan?.publishedAt && ` on ${new Date(plan.publishedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    {plan && <StatusPill status={plan.reviewStatus} />}
                  </div>

                  {/* Canvas Toolbar */}
                  <div className="flex items-center gap-2">
                    {plan?.kind === '3D' && plan?.data?.inputUrl && (
                      <button
                        type="button"
                        onClick={() => setShow3dSource((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg text-label-sm font-medium border border-outline-variant/60 transition-colors ${
                          show3dSource
                            ? 'bg-primary text-white'
                            : 'bg-surface dark:bg-surface-container hover:bg-surface-container-low text-on-surface'
                        }`}
                      >
                        {show3dSource ? 'Show 3D Render' : 'Compare 2D Source'}
                      </button>
                    )}
                    <button
                      className={btnGhost}
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="text-label-md font-mono min-w-[40px] text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      className={btnGhost}
                      onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      className={btnGhost}
                      onClick={() => setZoom(1)}
                      title="Reset zoom"
                    >
                      Reset
                    </button>
                    {(plan?.svgData || plan?.data?.imageUrl) && (
                      <button
                        className={btnGhost}
                        onClick={() =>
                          downloadAsset(
                            plan.svgData || plan.data?.imageUrl,
                            `${plan.name || 'FloorPlan'}.png`
                          )
                        }
                        title="Download image"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Download
                      </button>
                    )}
                  </div>
                </div>

                {/* Visualizer viewport */}
                <div className="p-6 overflow-auto bg-surface-container-low/40 dark:bg-surface-variant/20 min-h-[520px] flex items-center justify-center">
                  {renderVisualizerContent(plan, zoom)}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Modal for asking a question or requesting modifications */}
      {askFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setAskFor(null)}
        >
          <div
            className="bg-surface dark:bg-surface-container rounded-2xl p-6 w-full max-w-lg shadow-xl border border-outline-variant/60 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  {askFor === 'ask' ? 'help' : 'construction'}
                </span>
                <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">
                  {askFor === 'ask'
                    ? `Ask a Question about ${plan?.name}`
                    : `Request Modifications on ${plan?.name}`}
                </h3>
              </div>
              <button
                type="button"
                className="p-1 rounded-full hover:bg-surface-container-low text-on-surface-variant"
                onClick={() => setAskFor(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              {askFor === 'ask'
                ? 'Your architect will receive this question in their project inbox and notification feed.'
                : 'Describe the specific adjustments or layout changes you would like the architect to make.'}
            </p>

            <textarea
              className={inputClass + ' w-full'}
              rows={4}
              placeholder={
                askFor === 'ask'
                  ? 'e.g. Can we expand the master bedroom balcony or relocate the door?'
                  : 'e.g. Please swap the positions of the kitchen and pantry, and add a window facing south.'
              }
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setAskFor(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => sendReview(askFor)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Sending…' : askFor === 'ask' ? 'Send Question' : 'Submit Modification Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
