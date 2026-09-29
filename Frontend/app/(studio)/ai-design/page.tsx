'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Plan3DResult, Room3D } from '@/Backend/lib/ai-plan-generator';

const InteractiveBuilding3D = dynamic(
  () => import('@/Frontend/components/viewer/InteractiveBuilding3D').then((m) => m.InteractiveBuilding3D),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-on-surface-variant bg-[#F3F4F3] dark:bg-[#111917] rounded-xl p-8">
        <span className="material-symbols-outlined text-4xl animate-spin text-primary dark:text-inverse-primary mb-3">view_in_ar</span>
        <p className="font-mono-technical text-sm font-semibold">Initializing 3D spatial renderer…</p>
      </div>
    ),
  }
);

type FormState = {
  buildingType: string;
  floors: number;
  sqft: number;
  bedrooms: number;
  bathrooms: string;
  style: string;
  budget: number; // 1 Economy … 4 Luxury
  customPrompt: string;
};

const BUDGET_TIERS = ['Economy', 'Standard', 'Premium', 'Luxury'];

const STUDIO_NAV = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Design Studio', icon: 'architecture', href: '/ai-design', active: true },
  { label: 'Floor Plans', icon: 'edit_square', href: '/projects' },
  { label: '3D Visualizer', icon: 'view_in_ar', href: '/viewer' },
  { label: 'Marketplace', icon: 'storefront', href: '/marketplace-portal' },
  { label: 'Material Estimation', icon: 'request_quote', href: '/estimation' },
  { label: 'Projects', icon: 'folder_open', href: '/projects' },
  { label: 'Settings', icon: 'settings', href: '/profile?as=client' },
];

export default function AIDesignStudioPage() {
  const [tab, setTab] = useState<'requirements' | 'assistant' | 'specifications'>('requirements');
  const [viewMode, setViewMode] = useState<'3d' | 'blueprint' | 'split'>('3d');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [assistantMsg, setAssistantMsg] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);

  const [form, setForm] = useState<FormState>({
    buildingType: 'Residential Villa',
    floors: 2,
    sqft: 2800,
    bedrooms: 3,
    bathrooms: '3',
    style: 'Modern Minimalist',
    budget: 3,
    customPrompt: 'Include a cantilevered master balcony, shaded veranda, and a reflective pool deck',
  });

  const [planData, setPlanData] = useState<Plan3DResult | null>(null);
  const [rooms, setRooms] = useState<Room3D[]>([]);
  const [history, setHistory] = useState<Plan3DResult[]>([]);
  const [histIndex, setHistIndex] = useState(-1);

  const gridW = useMemo(() => {
    if (!rooms.length) return 20;
    const maxW = Math.max(...rooms.map((r) => r.x + r.w), 12);
    return maxW + 2;
  }, [rooms]);

  const gridH = useMemo(() => {
    if (!rooms.length) return 16;
    const maxH = Math.max(...rooms.map((r) => r.y + r.h), 10);
    return maxH + 2;
  }, [rooms]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingType: form.buildingType,
          floors: form.floors,
          sqft: form.sqft,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          style: form.style,
          budget: form.budget,
          customPrompt: form.customPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate architectural plan');

      const plan: Plan3DResult = data.plan;
      setPlanData(plan);
      setRooms(plan.flatRooms2D);
      setGenerated(true);
      setHistory((h) => [...h, plan]);
      setHistIndex((i) => i + 1);

      toast.success(`Generated ${plan.projectName} with Gemini AI!`);
    } catch (err: any) {
      toast.error(err.message || 'Generation error');
    } finally {
      setGenerating(false);
    }
  };

  const undo = () => {
    if (histIndex <= 0) {
      toast('Nothing to undo');
      return;
    }
    const i = histIndex - 1;
    setHistIndex(i);
    const p = history[i];
    setPlanData(p);
    setRooms(p.flatRooms2D);
  };

  const redo = () => {
    if (histIndex >= history.length - 1) {
      toast('Nothing to redo');
      return;
    }
    const i = histIndex + 1;
    setHistIndex(i);
    const p = history[i];
    setPlanData(p);
    setRooms(p.flatRooms2D);
  };

  const saveFloorPlan = async () => {
    if (!planData) {
      toast.error('Generate a layout first');
      return;
    }
    setSaving(true);
    const svg = document.getElementById('floorplan-svg')?.outerHTML ?? '';
    const res = await fetch('/api/floorplans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'proj_1',
        name: planData.projectName,
        data: { plan: planData, rooms, form },
        svgData: svg || 'interactive-3d-plan',
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) toast.success('Floor plan and 3D specifications saved to project');
    else toast.error(data.error ?? 'Could not save');
  };

  const exportImage = () => {
    if (viewMode === '3d') {
      const canvas = document.querySelector('#interactive-building-canvas canvas') as HTMLCanvasElement;
      if (!canvas) return toast.error('3D Viewer not ready');
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(planData?.projectName ?? 'floor-plan').toLowerCase().replace(/\s+/g, '-')}-3d.png`;
      a.click();
      toast.success('3D Perspective snapshot exported');
      return;
    }

    const svg = document.getElementById('floorplan-svg');
    if (!svg) {
      toast.error('Generate a layout first');
      return;
    }
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(planData?.projectName ?? 'floor-plan').toLowerCase().replace(/\s+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Floor plan exported as SVG');
  };

  const sendAssistant = async () => {
    const text = assistantMsg.trim();
    if (!text) return;
    setChat((prev) => [...prev, { role: 'user', text }]);
    setAssistantMsg('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/plan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planData,
          instruction: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gemini Assistant failed to respond');

      setChat((prev) => [...prev, { role: 'ai', text: data.reply }]);
      if (data.updatedPlan) {
        setPlanData(data.updatedPlan);
        setRooms(data.updatedPlan.flatRooms2D);
        toast.success('3D visualization updated to reflect instructions');
      }
    } catch (err: any) {
      setChat((prev) => [...prev, { role: 'ai', text: 'Error modifying plan: ' + err.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const field =
    'w-full bg-white dark:bg-tertiary border border-[#DDE2E0] dark:border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-[#315C4C] dark:focus:border-inverse-primary focus:ring-2 focus:ring-[#315C4C]/10 dark:focus:ring-inverse-primary/10 transition-all';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#FAFAF8] dark:bg-on-background">
      {/* Top bar */}
      <header className="bg-white dark:bg-inverse-surface w-full border-b border-outline-variant dark:border-outline-variant/30 h-16 flex justify-between items-center px-gutter shrink-0">
        <div className="flex items-center gap-xl">
          <Link href="/dashboard" className="text-headline-md font-bold text-primary dark:text-inverse-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[26px]">architecture</span>
            BuildSmart AI
          </Link>
          <nav className="hidden md:flex gap-lg text-body-md">
            <Link href="/architect/3d" className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors">
              3D Portal
            </Link>
            <Link href="/architect/floorplans" className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors">
              2D Editor
            </Link>
            <Link href="/architect/gemini" className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Gemini Copilot
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary dark:text-inverse-primary dark:bg-inverse-primary/10 px-3 py-1.5 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Gemini 3.6 Flash Active
          </div>
          <Link href="/dashboard" className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold">
            EV
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Project sidebar */}
        <aside className="hidden md:flex w-64 flex-shrink-0 flex-col py-md border-r border-outline-variant dark:border-outline-variant/30 bg-white dark:bg-inverse-surface">
          <div className="px-gutter mb-lg">
            <div className="text-headline-sm font-bold text-primary dark:text-inverse-primary mb-1">
              {planData?.projectName ?? 'Project Alpha'}
            </div>
            <div className="text-body-sm text-on-surface-variant dark:text-outline-variant">
              Lead Architect Studio
            </div>
          </div>
          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {STUDIO_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 mx-2 my-1 rounded-lg transition-all duration-200 ${
                  item.active
                    ? 'bg-primary-container dark:bg-primary-fixed-dim text-on-primary-container dark:text-on-primary-fixed font-semibold'
                    : 'text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-high dark:hover:bg-tertiary-container'
                }`}
              >
                <span className="material-symbols-outlined" style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {item.icon}
                </span>
                <span className="text-label-md">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="px-gutter mt-auto pt-lg border-t border-outline-variant dark:border-outline-variant/30">
            <Link
              href="/projects"
              className="w-full bg-primary dark:bg-inverse-primary hover:bg-[#264B3E] dark:hover:bg-primary-fixed-dim text-on-primary dark:text-on-primary-fixed text-label-md py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mb-md"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Project
            </Link>
            <div className="flex flex-col gap-1">
              <Link href="/support" className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors flex items-center gap-3 px-2 py-2">
                <span className="material-symbols-outlined text-[18px]">help</span>
                <span className="text-label-md">Help Center</span>
              </Link>
              <Link href="/dashboard" className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors flex items-center gap-3 px-2 py-2">
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span className="text-label-md">Back to Dashboard</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAF8] dark:bg-on-background">
          {/* Studio toolbar */}
          <div className="h-14 border-b border-outline-variant dark:border-outline-variant/30 flex items-center justify-between px-md bg-white dark:bg-inverse-surface shrink-0">
            <div className="flex items-center gap-sm">
              <div className="text-label-md text-on-surface dark:text-inverse-on-surface bg-surface-container-low dark:bg-tertiary-container px-3 py-1.5 rounded border border-outline-variant dark:border-outline-variant/30 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary dark:text-inverse-primary">domain</span>
                {planData?.projectName ?? `${form.buildingType} (${form.floors} Storey)`}
              </div>
              <span className="text-outline-variant px-2">|</span>
              <button onClick={undo} className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors flex items-center gap-1" title="Undo">
                <span className="material-symbols-outlined text-[20px]">undo</span>
              </button>
              <button onClick={redo} className="text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-inverse-primary transition-colors flex items-center gap-1" title="Redo">
                <span className="material-symbols-outlined text-[20px]">redo</span>
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-surface-container-low dark:bg-tertiary-container p-1 rounded-lg border border-outline-variant/50">
              <button
                onClick={() => setViewMode('3d')}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === '3d'
                    ? 'bg-primary text-white dark:bg-inverse-primary dark:text-on-primary-fixed shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">view_in_ar</span>
                Interactive 3D
              </button>
              <button
                onClick={() => setViewMode('blueprint')}
                className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'blueprint'
                    ? 'bg-primary text-white dark:bg-inverse-primary dark:text-on-primary-fixed shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">map</span>
                2D Blueprint
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`hidden xl:flex px-3 py-1 text-xs font-semibold rounded items-center gap-1.5 transition-colors ${
                  viewMode === 'split'
                    ? 'bg-primary text-white dark:bg-inverse-primary dark:text-on-primary-fixed shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                Split 2D / 3D
              </button>
            </div>

            <div className="flex items-center gap-md">
              <button onClick={saveFloorPlan} disabled={saving || !generated} className="border border-[#17201E] dark:border-outline-variant/30 text-[#17201E] dark:text-inverse-on-surface hover:bg-[#F6F7F7] dark:hover:bg-tertiary-container text-label-md py-1.5 px-4 rounded transition-colors flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">save</span>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={exportImage} disabled={!generated} className="border border-[#17201E] dark:border-outline-variant/30 text-[#17201E] dark:text-inverse-on-surface hover:bg-[#F6F7F7] dark:hover:bg-tertiary-container text-label-md py-1.5 px-4 rounded transition-colors flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export
              </button>
            </div>
          </div>

          {/* Main Visualizer Area */}
          <div className="flex-1 relative overflow-hidden flex p-4 gap-4 bg-[#FAFAF8] dark:bg-on-background">
            {/* Generating Overlay */}
            {generating && (
              <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center">
                <div className="bg-white dark:bg-[#131e1b] p-8 rounded-2xl shadow-xl border border-outline-variant max-w-md w-full text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 text-primary dark:text-inverse-primary flex items-center justify-center animate-bounce">
                    <span className="material-symbols-outlined text-3xl">auto_awesome</span>
                  </div>
                  <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
                    Gemini AI Generative Engine
                  </h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-outline-variant">
                    Synthesizing 3D spatial layout, multi-storey room coordinates, daylighting orientation, and material properties...
                  </p>
                  <div className="w-full bg-surface-container-low rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              </div>
            )}

            {/* Left/Main View */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div className={`relative h-full rounded-xl overflow-hidden shadow-sm flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                <InteractiveBuilding3D plan={planData} rooms={rooms} />
              </div>
            )}

            {(viewMode === 'blueprint' || viewMode === 'split') && (
              <div className={`relative h-full border-2 border-primary/20 dark:border-inverse-primary/20 bg-white/70 dark:bg-inverse-surface/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm flex items-center justify-center p-6 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                {generated && rooms.length > 0 ? (
                  <svg id="floorplan-svg" viewBox={`0 0 ${gridW} ${gridH}`} className="w-full h-full p-4" preserveAspectRatio="xMidYMid meet">
                    {/* Architectural Grid Lines */}
                    {Array.from({ length: Math.ceil(gridW) }).map((_, i) => (
                      <line key={`gv-${i}`} x1={i} y1={0} x2={i} y2={gridH} stroke="#dde2e0" strokeWidth={0.03} strokeDasharray="0.1,0.1" />
                    ))}
                    {Array.from({ length: Math.ceil(gridH) }).map((_, i) => (
                      <line key={`gh-${i}`} x1={0} y1={i} x2={gridW} y2={i} stroke="#dde2e0" strokeWidth={0.03} strokeDasharray="0.1,0.1" />
                    ))}

                    {/* Room Footprints */}
                    {rooms.map((r, i) => (
                      <g key={r.id || i}>
                        <rect
                          x={r.x}
                          y={r.y}
                          width={r.w}
                          height={r.h}
                          fill={r.color ? `${r.color}15` : '#effcf7'}
                          stroke={r.color ?? '#315C4C'}
                          strokeWidth={0.08}
                          rx={0.12}
                        />
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 0.18} textAnchor="middle" fontSize={0.42} fill="#131e1b" fontWeight={600}>
                          {r.name}
                        </text>
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 0.38} textAnchor="middle" fontSize={0.34} fill="#414944">
                          {r.w.toFixed(1)} × {r.h.toFixed(1)} m ({(r.w * r.h).toFixed(0)}m²)
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <div className="text-center text-outline dark:text-outline-variant">
                    <span className="material-symbols-outlined text-5xl mb-2 opacity-50">architecture</span>
                    <p className="font-mono-technical font-semibold">{generating ? 'Generating layout…' : 'AI 3D layout will appear here.'}</p>
                    <p className="text-body-sm mt-1">Configure requirements or prompt on the right to begin.</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 font-mono-technical text-xs text-primary/70 dark:text-inverse-primary/70 bg-white/80 dark:bg-black/50 px-2 py-1 rounded">
                  SCALE: 1:100 (METRIC)
                </div>
                <div className="absolute bottom-4 right-4 font-mono-technical text-xs text-primary/70 dark:text-inverse-primary/70 bg-white/80 dark:bg-black/50 px-2 py-1 rounded">
                  NORTH ↑
                </div>
              </div>
            )}

            {/* Floating Quick Action Overlay at Bottom Center */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
              <button
                onClick={generate}
                disabled={generating}
                className="bg-[#315C4C] dark:bg-inverse-primary hover:bg-[#264B3E] dark:hover:bg-primary-fixed-dim text-white dark:text-on-primary-fixed text-label-md py-3 px-8 rounded-full shadow-[0_6px_20px_rgba(23,32,30,0.2)] transition-all flex items-center gap-2.5 disabled:opacity-70 font-semibold"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                {generating ? 'Generating with Gemini…' : 'Generate AI 3D Plan'}
              </button>
            </div>
          </div>
        </main>

        {/* Right Panel: Requirements, Specifications & Assistant */}
        <aside className="hidden lg:flex w-84 xl:w-96 flex-shrink-0 flex-col border-l border-outline-variant dark:border-outline-variant/30 bg-white dark:bg-inverse-surface">
          <div className="flex border-b border-outline-variant dark:border-outline-variant/30 h-14 shrink-0">
            <button
              onClick={() => setTab('requirements')}
              className={`flex-1 text-label-md flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === 'requirements'
                  ? 'border-primary dark:border-inverse-primary text-primary dark:text-inverse-primary bg-surface-container-low/50 dark:bg-tertiary-container/50 font-semibold'
                  : 'text-on-surface-variant dark:text-outline-variant hover:bg-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">tune</span>
              Requirements
            </button>
            <button
              onClick={() => setTab('specifications')}
              className={`flex-1 text-label-md flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === 'specifications'
                  ? 'border-primary dark:border-inverse-primary text-primary dark:text-inverse-primary bg-surface-container-low/50 dark:bg-tertiary-container/50 font-semibold'
                  : 'text-on-surface-variant dark:text-outline-variant hover:bg-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">analytics</span>
              Insights
            </button>
            <button
              onClick={() => setTab('assistant')}
              className={`flex-1 text-label-md flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === 'assistant'
                  ? 'border-primary dark:border-inverse-primary text-primary dark:text-inverse-primary bg-surface-container-low/50 dark:bg-tertiary-container/50 font-semibold'
                  : 'text-on-surface-variant dark:text-outline-variant hover:bg-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">forum</span>
              Assistant
            </button>
          </div>

          {tab === 'requirements' ? (
            <div className="flex-1 overflow-y-auto p-md space-y-md">
              <div className="space-y-sm">
                <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">
                  Building Type
                </label>
                <select className={field} value={form.buildingType} onChange={(e) => set('buildingType', e.target.value)}>
                  {['Residential Villa', 'Modern Duplex', 'Executive Bungalow', 'Commercial Office', 'Mixed-Use Complex', 'Eco-Lodge'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-sm">
                  <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Storeys / Floors</label>
                  <input className={field} type="number" min={1} max={4} value={form.floors} onChange={(e) => set('floors', Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))} />
                </div>
                <div className="space-y-sm">
                  <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Total SqFt</label>
                  <input className={field} type="text" placeholder="e.g. 2800" value={form.sqft} onChange={(e) => set('sqft', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-sm">
                  <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Bedrooms</label>
                  <select className={field} value={form.bedrooms} onChange={(e) => set('bedrooms', parseInt(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Bedrooms
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-sm">
                  <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Bathrooms</label>
                  <select className={field} value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)}>
                    {['1', '2', '3', '4', '5'].map((o) => (
                      <option key={o}>{o} Bathrooms</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-sm">
                <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Architectural Style</label>
                <select className={field} value={form.style} onChange={(e) => set('style', e.target.value)}>
                  {['Modern Minimalist', 'Tropical Contemporary', 'Brutalist & Exposed Concrete', 'Industrial Loft', 'Neo-Classical Villa'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-sm">
                <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold">Budget Range</label>
                <input className="w-full accent-[#315C4C] dark:accent-inverse-primary" type="range" min={1} max={4} value={form.budget} onChange={(e) => set('budget', parseInt(e.target.value))} />
                <div className="flex justify-between font-mono-technical text-xs text-outline-variant">
                  <span>Economy</span>
                  <span>Standard</span>
                  <span>Premium</span>
                  <span>Luxury</span>
                </div>
              </div>

              <div className="space-y-sm">
                <label className="block text-label-md text-[#17201E] dark:text-inverse-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">edit_note</span>
                  Specific Requirements & Amenities
                </label>
                <textarea
                  className={`${field} h-20 resize-none text-xs`}
                  placeholder="e.g. Open-concept kitchen with island, infinity pool, cantilevered master balcony, double-height living room..."
                  value={form.customPrompt}
                  onChange={(e) => set('customPrompt', e.target.value)}
                />
              </div>

              {/* Quick Summary Card */}
              {planData && (
                <div className="bg-primary/5 dark:bg-inverse-primary/5 border border-primary/20 dark:border-inverse-primary/20 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-primary dark:text-inverse-primary">
                    <span>{planData.totalAreaM2} m² Total Living Area</span>
                    <span>{planData.floorsCount} Floors</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant dark:text-outline-variant line-clamp-3 leading-relaxed">
                    {planData.concept}
                  </p>
                </div>
              )}
            </div>
          ) : tab === 'specifications' ? (
            <div className="flex-1 overflow-y-auto p-md space-y-md">
              {planData ? (
                <>
                  <div className="space-y-1">
                    <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
                      {planData.projectName}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-mono-technical">
                      {planData.style} · {planData.buildingType}
                    </p>
                  </div>

                  {/* Financial & Timeline Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-container-low dark:bg-tertiary-container p-3 rounded-lg border border-outline-variant/40">
                      <span className="text-[11px] text-on-surface-variant block">Est. Material Cost</span>
                      <span className="text-sm font-bold text-primary dark:text-inverse-primary font-mono-technical">
                        {planData.estimatedCostXAF.toLocaleString()} XAF
                      </span>
                    </div>
                    <div className="bg-surface-container-low dark:bg-tertiary-container p-3 rounded-lg border border-outline-variant/40">
                      <span className="text-[11px] text-on-surface-variant block">Timeline</span>
                      <span className="text-sm font-bold text-on-surface dark:text-inverse-on-surface font-mono-technical">
                        ~{planData.estimatedTimelineWeeks} Weeks
                      </span>
                    </div>
                  </div>

                  {/* Structural Notes */}
                  <div className="space-y-1 bg-surface-container-low dark:bg-tertiary-container p-3 rounded-lg border border-outline-variant/40 text-xs">
                    <span className="font-semibold text-on-surface block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">foundation</span>
                      Structural System
                    </span>
                    <p className="text-on-surface-variant leading-relaxed">{planData.structuralSystem}</p>
                  </div>

                  {/* Sustainability Notes */}
                  <div className="space-y-1.5 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300 block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">energy_savings_leaf</span>
                      Passive Climate Optimization
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-emerald-900 dark:text-emerald-200">
                      {planData.sustainabilityNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Bill of Materials Summary */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-on-surface block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">list_alt</span>
                      Preliminary Materials Estimate
                    </span>
                    <div className="border border-outline-variant/60 rounded-lg overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-surface-container-low dark:bg-tertiary-container border-b border-outline-variant/60 text-on-surface-variant">
                          <tr>
                            <th className="p-2 font-medium">Material</th>
                            <th className="p-2 font-medium text-right">Est. Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40">
                          {planData.materialsSummary.map((m, i) => (
                            <tr key={i} className="hover:bg-surface-container-lowest">
                              <td className="p-2">
                                <span className="font-medium text-on-surface block">{m.name}</span>
                                <span className="text-[10px] text-on-surface-variant">{m.category}</span>
                              </td>
                              <td className="p-2 text-right font-mono-technical font-semibold">{m.estimatedQty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-on-surface-variant text-xs">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">analytics</span>
                  <p>Generate a 3D plan to view AI architectural insights and material breakdowns.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-md overflow-hidden">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="p-3 bg-surface-container-low dark:bg-tertiary-container rounded-lg text-body-sm text-on-surface dark:text-on-surface flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">auto_awesome</span>
                  <div>
                    <p className="font-semibold text-xs text-primary dark:text-inverse-primary mb-1">Gemini Design Assistant</p>
                    <p className="text-xs leading-relaxed">
                      I can help you adjust rooms, change facade materials, expand the master suite, add balconies, or optimize passive ventilation. Just describe your design change below!
                    </p>
                  </div>
                </div>

                {chat.map((c, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      c.role === 'user'
                        ? 'bg-primary-container dark:bg-primary-fixed-dim text-on-primary-container dark:text-on-primary-fixed ml-6'
                        : 'bg-surface-container-low dark:bg-tertiary-container text-on-surface dark:text-on-surface mr-6'
                    }`}
                  >
                    {c.text}
                  </div>
                ))}

                {chatLoading && (
                  <div className="p-3 bg-surface-container-low dark:bg-tertiary-container rounded-lg text-xs flex items-center gap-2 text-on-surface-variant mr-6">
                    <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                    <span>Gemini is adjusting architectural geometry…</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-outline-variant dark:border-outline-variant/30 shrink-0">
                <input
                  className={`${field} flex-1 text-xs`}
                  placeholder="e.g. Add a rooftop terrace on floor 2…"
                  value={assistantMsg}
                  onChange={(e) => setAssistantMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !chatLoading && sendAssistant()}
                  disabled={chatLoading || !planData}
                />
                <button
                  onClick={sendAssistant}
                  disabled={chatLoading || !planData || !assistantMsg.trim()}
                  className="bg-primary dark:bg-inverse-primary text-on-primary dark:text-on-primary-fixed rounded-lg px-4 text-label-md disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
