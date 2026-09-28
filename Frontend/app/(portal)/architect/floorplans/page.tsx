'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Field, inputClass, btnPrimary, btnGhost, btnDanger, EmptyState, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { SendFloorPlansModal } from '@/Frontend/components/roomagen/SendFloorPlansModal';
import { AiFloorPlanBoqModal } from '@/Frontend/components/roomagen/AiFloorPlanBoqModal';

type Room = { id: string; name: string; x: number; y: number; w: number; h: number };
const S = 40; // px per meter
const SNAP = 0.5;

function validations(rooms: Room[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlap) warnings.push(`Rooms "${a.name}" and "${b.name}" overlap.`);
    }
    if (rooms[i].w <= 0.5 || rooms[i].h <= 0.5) warnings.push(`Room "${rooms[i].name}" has an invalid dimension.`);
    if (!rooms[i].name.trim()) warnings.push('A room is missing a label.');
  }
  return warnings;
}

export default function ArchitectFloorPlansPage() {
  const { data: projectsData, loading: loadingProjects } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [projectId, setProjectId] = useState('');
  const projects = useMemo(() => projectsData?.projects ?? [], [projectsData]);
  const activeProjectId = projectId || projects[0]?.id || '';
  const { data: plansData, loading: loadingPlans, refetch } = useApi<{ floorPlans: any[] }>(activeProjectId ? `/api/architect/floorplans?projectId=${activeProjectId}` : '/api/architect/floorplans?projectId=none');
  const plans = plansData?.floorPlans ?? [];
  // '__new__' = editing a brand-new plan, null = auto-select first saved plan.
  const [planId, setPlanId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // When arriving from the design-request flow (?project=&plan=), preselect that
  // project and plan after the project list loads.
  useEffect(() => {
    if (initialized) return;
    if (loadingProjects || projects.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    const plan = params.get('plan');
    if (project && projects.some((p: any) => p.id === project)) {
      setProjectId(project);
    } else {
      setProjectId(projects[0].id);
    }
    if (plan) setPlanId(plan);
    setInitialized(true);
  }, [loadingProjects, projects, initialized]);
  const activePlan = planId === '__new__' ? null : (plans.find((p) => p.id === planId) ?? (planId === null ? plans[0] : null)) ?? null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Room[][]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [name, setName] = useState('Untitled Plan');
  const [zoom, setZoom] = useState(1);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [boqModalPlan, setBoqModalPlan] = useState<any | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; id: string; startX: number; startY: number; orig: Room } | null>(null);

  // Reset editor state whenever the active plan (or new-plan mode) changes.
  const [editorKey, setEditorKey] = useState<string>('__none__');
  const keyNow = activePlan?.id ?? (planId === '__new__' ? '__new__' : '__none__');
  if (keyNow !== editorKey) {
    setEditorKey(keyNow);
    if (activePlan) {
      setName(activePlan.name ?? 'Untitled Plan');
      const rs = Array.isArray(activePlan.data?.rooms) ? activePlan.data.rooms : [];
      const mapped = rs.map((r: any, i: number) => ({ id: r.id ?? `r${i}`, name: r.name, x: r.x, y: r.y, w: r.w, h: r.h }));
      setRooms(mapped);
      setHistory([mapped]);
    } else {
      setName('Untitled Plan');
      setRooms([]);
      setHistory([[]]);
    }
    setHistIdx(0);
    setSelected(null);
  }

  const pushHistory = useCallback((next: Room[]) => {
    setHistory((h) => [...h.slice(0, histIdx + 1), next]);
    setHistIdx((i) => i + 1);
  }, [histIdx]);

  const commit = (next: Room[]) => {
    setRooms(next);
    pushHistory(next);
  };

  const undo = () => { if (histIdx > 0) { setHistIdx(histIdx - 1); setRooms(history[histIdx - 1]); } };
  const redo = () => { if (histIdx < history.length - 1) { setHistIdx(histIdx + 1); setRooms(history[histIdx + 1]); } };

  const addRoom = () => {
    const id = `r${Date.now().toString(36)}`;
    commit([...rooms, { id, name: `Room ${rooms.length + 1}`, x: snap(0), y: snap(0), w: 3, h: 3 }]);
    setSelected(id);
  };

  const deleteRoom = (id: string) => commit(rooms.filter((r) => r.id !== id));

  const updateRoom = (id: string, patch: Partial<Room>) => commit(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onPointerDown = (e: React.PointerEvent, room: Room, mode: 'move' | 'resize') => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelected(room.id);
    dragRef.current = { mode, id: room.id, startX: e.clientX, startY: e.clientY, orig: { ...room } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / (S * zoom);
    const dy = (e.clientY - d.startY) / (S * zoom);
    if (d.mode === 'move') {
      setRooms(rooms.map((r) => (r.id === d.id ? { ...r, x: snap(d.orig.x + dx), y: snap(d.orig.y + dy) } : r)));
    } else {
      setRooms(rooms.map((r) => (r.id === d.id ? { ...r, w: snap(Math.max(0.5, d.orig.w + dx)), h: snap(Math.max(0.5, d.orig.h + dy)) } : r)));
    }
  };

  const onPointerUp = () => {
    if (dragRef.current) { pushHistory(rooms); dragRef.current = null; }
  };

  const save = async (asNew = false) => {
    if (!activeProjectId) return toast.error('Select a project first');
    const warnings = validations(rooms);
    try {
      const body = { projectId: activeProjectId, name: asNew ? `${name} (copy)` : name, data: { rooms }, svgData: 'editor' };
      if (activePlan && !asNew) await api('PATCH', '/api/architect/floorplans', { id: activePlan.id, ...body });
      else await api('POST', '/api/architect/floorplans', body);
      toast.success(asNew ? 'Saved as new version' : 'Floor plan saved');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
    if (warnings.length) toast.warning(`${warnings.length} validation warning(s) detected`);
  };

  const exportSvg = () => {
    const svg = document.getElementById('floorplan-canvas');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\s+/g, '-')}.svg`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Floor plan exported');
  };

  const warnings = validations(rooms);
  const sel = rooms.find((r) => r.id === selected);
  const plotW = 24, plotH = 16;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1500px] mx-auto">
      <PageHeader title="2D Floor Plan Editor" subtitle="Draw walls, place rooms, add dimensions and validate your plan." crumbs={['Architect', 'Design Studio', '2D Floor Plan Editor']}
        actions={<>
          <button className={btnGhost} onClick={undo}><span className="material-symbols-outlined text-[18px]">undo</span>Undo</button>
          <button className={btnGhost} onClick={redo}><span className="material-symbols-outlined text-[18px]">redo</span>Redo</button>
          <button className={btnGhost} onClick={() => save(true)}><span className="material-symbols-outlined text-[18px]">versioning</span>Save as Version</button>
          <button className={btnGhost} onClick={exportSvg}><span className="material-symbols-outlined text-[18px]">download</span>Export</button>
          <button className={btnPrimary} onClick={() => save(false)}><span className="material-symbols-outlined text-[18px]">save</span>Save</button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs shadow-sm transition-all"
            onClick={() => setSendModalOpen(true)}
            title="Send 2D/3D floor plans to client for review"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>Send to Client
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-all"
            onClick={() => {
              if (activePlan) {
                setBoqModalPlan(activePlan);
              } else {
                toast.info('Please save or select a floor plan to generate AI BOQ & Estimates');
              }
            }}
            title="Analyze floor plan and generate preliminary BOQ & Material Estimation"
          >
            <span className="material-symbols-outlined text-[16px]">calculate</span>AI Estimate & BOQ
          </button>
        </>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: project + plans */}
        <div className="space-y-4">
          <Card>
            <Field label="Project">
              <select className={inputClass} value={activeProjectId} onChange={(e) => { setProjectId(e.target.value); setPlanId(null); }}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </Card>
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Floor Plans</h4>
            {loadingPlans ? <Skeleton className="h-24" /> : (plansData?.floorPlans ?? []).length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No plans yet — start drawing below.</p>
            ) : (
              <div className="space-y-1">
                {(plansData?.floorPlans ?? []).map((p) => (
                  <button key={p.id} onClick={() => setPlanId(p.id)} className={`w-full text-left px-3 py-2 rounded-lg text-body-sm ${activePlan?.id === p.id ? 'bg-secondary-container dark:bg-primary-container text-primary font-semibold' : 'hover:bg-surface-container-low dark:hover:bg-surface-variant text-on-surface dark:text-inverse-on-surface'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <button className={btnPrimary + ' w-full mt-3'} onClick={() => setPlanId('__new__')}>New Plan</button>
          </Card>
          {warnings.length > 0 && (
            <Card className="border-[#F5D09D] dark:border-yellow-700 bg-[#FFF4E5] dark:bg-yellow-900/20">
              <h4 className="text-headline-sm text-[#A66A00] dark:text-yellow-500 mb-2">Validation Warnings</h4>
              <ul className="text-body-sm text-on-surface dark:text-inverse-on-surface list-disc list-inside space-y-1">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              <p className="text-[11px] text-on-surface-variant dark:text-surface-variant mt-2">Warnings are advisory — they do not constitute engineering approval.</p>
            </Card>
          )}
        </div>

        {/* Center: canvas */}
        <div className="lg:col-span-2">
          <Card pad={false}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant dark:border-outline">
              <input className="text-headline-sm text-on-surface dark:text-inverse-on-surface bg-transparent focus:outline-none w-2/3" value={name} onChange={(e) => setName(e.target.value)} aria-label="Plan name" />
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-surface-container-low" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} aria-label="Zoom out"><span className="material-symbols-outlined">remove</span></button>
                <span className="text-label-md font-mono-technical">{Math.round(zoom * 100)}%</span>
                <button className="p-1.5 rounded hover:bg-surface-container-low" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label="Zoom in"><span className="material-symbols-outlined">add</span></button>
              </div>
            </div>
            <div className="overflow-auto p-4 bg-surface-container-low dark:bg-surface-variant" style={{ minHeight: 520 }}>
              <svg id="floorplan-canvas" viewBox={`0 0 ${plotW * S} ${plotH * S}`} style={{ width: plotW * S * zoom, height: plotH * S * zoom, maxWidth: 'none' }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                <rect width={plotW * S} height={plotH * S} fill="#fff" stroke="#c0c8c3" />
                {Array.from({ length: plotW * 2 }).map((_, i) => <line key={`v${i}`} x1={i * S / 2} y1={0} x2={i * S / 2} y2={plotH * S} stroke="#e4e9e7" strokeWidth={i % 2 ? 0.5 : 1} />)}
                {Array.from({ length: plotH * 2 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * S / 2} x2={plotW * S} y2={i * S / 2} stroke="#e4e9e7" strokeWidth={i % 2 ? 0.5 : 1} />)}
                {rooms.map((r) => (
                  <g key={r.id} style={{ cursor: 'move' }} onPointerDown={(e) => onPointerDown(e, r, 'move')}>
                    <rect x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill={selected === r.id ? '#C0E9D7' : '#EAF7F1'} stroke={selected === r.id ? '#184436' : '#315C4C'} strokeWidth={selected === r.id ? 3 : 2} rx={2} />
                    <text x={r.x * S + 6} y={r.y * S + 16} fontSize={12} fill="#184436" fontWeight={600}>{r.name}</text>
                    <text x={r.x * S + 6} y={r.y * S + 30} fontSize={10} fill="#5c6f68">{r.w}×{r.h}m</text>
                    <rect x={(r.x + r.w) * S - 10} y={(r.y + r.h) * S - 10} width={10} height={10} fill="#315C4C" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => onPointerDown(e, r, 'resize')} />
                  </g>
                ))}
              </svg>
            </div>
          </Card>
        </div>

        {/* Right: inspector */}
        <div className="space-y-4">
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Tools</h4>
            <div className="grid grid-cols-2 gap-2">
              <button className={btnGhost} onClick={addRoom}><span className="material-symbols-outlined text-[18px]">add_box</span>Add Room</button>
              <button className={btnDanger} disabled={!selected} onClick={() => selected && deleteRoom(selected)}><span className="material-symbols-outlined text-[18px]">delete</span>Delete</button>
            </div>
          </Card>
          {sel && (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Selected Room</h4>
              <div className="space-y-3">
                <Field label="Label"><input className={inputClass} value={sel.name} onChange={(e) => updateRoom(sel.id, { name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Width (m)"><input className={inputClass} type="number" step={SNAP} min={0.5} value={sel.w} onChange={(e) => updateRoom(sel.id, { w: Number(e.target.value) })} /></Field>
                  <Field label="Height (m)"><input className={inputClass} type="number" step={SNAP} min={0.5} value={sel.h} onChange={(e) => updateRoom(sel.id, { h: Number(e.target.value) })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="X (m)"><input className={inputClass} type="number" step={SNAP} value={sel.x} onChange={(e) => updateRoom(sel.id, { x: Number(e.target.value) })} /></Field>
                  <Field label="Y (m)"><input className={inputClass} type="number" step={SNAP} value={sel.y} onChange={(e) => updateRoom(sel.id, { y: Number(e.target.value) })} /></Field>
                </div>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Area: {(sel.w * sel.h).toFixed(1)} m² · Snap: {SNAP}m</p>
              </div>
            </Card>
          )}
          {!loadingProjects && projects.length === 0 && <EmptyState icon="architecture" title="No projects" body="Create a project first to save floor plans." />}
        </div>
      </div>

      <SendFloorPlansModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        projectId={activeProjectId}
        projectName={projects.find((p) => p.id === activeProjectId)?.name}
        onSentSuccessfully={() => refetch()}
      />

      <AiFloorPlanBoqModal
        isOpen={!!boqModalPlan}
        onClose={() => setBoqModalPlan(null)}
        floorPlan={boqModalPlan}
        projectId={activeProjectId}
        onBoqSent={() => {
          refetch();
        }}
      />
    </div>
  );
}

function snap(v: number) {
  return Math.round(v / SNAP) * SNAP;
}
