'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { inputClass, btnGhost, btnPrimary } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import type { Plan3DResult, Room3D } from '@/Backend/lib/ai-plan-generator';

const InteractiveBuilding3D = dynamic(
  () => import('@/Frontend/components/viewer/InteractiveBuilding3D').then((m) => m.InteractiveBuilding3D),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-on-surface-variant font-mono-technical">
        <span className="material-symbols-outlined text-4xl animate-spin text-primary mb-2">view_in_ar</span>
        <span>Loading 3D visualization scene…</span>
      </div>
    ),
  }
);

export default function Architect3DPage() {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [projectId, setProjectId] = useState('');
  const projects = projectsData?.projects ?? [];
  const activeId = projectId || projects[0]?.id || '';
  const { data: plansData } = useApi<{ floorPlans: any[] }>(
    activeId ? `/api/architect/floorplans?projectId=${activeId}` : '/api/architect/floorplans?projectId=none'
  );

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan3DResult | null>(null);

  const [aiForm, setAiForm] = useState({
    buildingType: 'Modern Villa',
    floors: 2,
    bedrooms: 4,
    bathrooms: '3',
    style: 'Tropical Contemporary',
    budget: 3,
    customPrompt: 'Include a cantilevered master balcony, shaded veranda, and a reflective pool deck',
  });

  const rooms: Room3D[] = useMemo(() => {
    if (generatedPlan?.flatRooms2D?.length) {
      return generatedPlan.flatRooms2D;
    }
    const plan = plansData?.floorPlans?.[0];
    const rs = plan?.data?.rooms;
    if (Array.isArray(rs) && rs.length) {
      return rs.map((r: any, idx: number) => ({
        id: r.id || `r-${idx}`,
        name: r.name,
        type: r.type || 'living',
        w: r.w,
        h: r.h,
        x: r.x,
        y: r.y,
        color: r.color,
      }));
    }
    // Fallback sample
    return [
      { id: 'r1', name: 'Living Room', type: 'living', w: 6.5, h: 5.0, x: 0, y: 0, color: '#315C4C' },
      { id: 'r2', name: 'Kitchen & Dining', type: 'kitchen', w: 4.2, h: 4.5, x: 6.7, y: 0, color: '#D97706' },
      { id: 'r3', name: 'Master Suite', type: 'bedroom', w: 5.2, h: 4.8, x: 0, y: 5.3, color: '#2A7A64' },
      { id: 'r4', name: 'Bedroom 2', type: 'bedroom', w: 3.8, h: 3.8, x: 5.4, y: 5.3, color: '#2A7A64' },
      { id: 'r5', name: 'Terrace & Pool', type: 'pool', w: 5.5, h: 3.2, x: 0, y: -3.5, color: '#38BDF8' },
    ];
  }, [generatedPlan, plansData]);

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate 3D building plan');

      setGeneratedPlan(data.plan);
      setAiModalOpen(false);
      toast.success(`Generated 3D ${data.plan.style} plan with Gemini AI!`);
    } catch (err: any) {
      toast.error(err.message || 'Generation error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#FAFAF8] dark:bg-[#111917]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-outline-variant dark:border-outline bg-white dark:bg-[#17201e] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest">
              Interactive 3D Architectural Visualizer
            </h1>
            {generatedPlan && (
              <span className="text-xs bg-primary/10 text-primary dark:text-inverse-primary px-2.5 py-0.5 rounded-full font-semibold">
                AI Synthesized: {generatedPlan.projectName}
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant dark:text-surface-variant">
            Orbit with left-drag · zoom with scroll · pan with right-drag · slice storeys & cutaway in toolbar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <select
              className={inputClass}
              value={activeId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setGeneratedPlan(null);
              }}
            >
              <option value="">Select saved project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setAiModalOpen(true)}
            className="bg-[#315C4C] hover:bg-[#264B3E] text-white dark:bg-inverse-primary dark:text-on-primary-fixed text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
            Generate with Gemini AI
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="flex-1 relative p-4">
        <InteractiveBuilding3D
          plan={generatedPlan}
          rooms={rooms}
          floors={generatedPlan?.floors}
          showControlsBar={true}
        />
      </div>

      {/* AI Generation Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131e1b] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
                <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
                  Generate 3D Architectural Plan
                </h3>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Building Type</label>
                <select
                  className={inputClass}
                  value={aiForm.buildingType}
                  onChange={(e) => setAiForm({ ...aiForm, buildingType: e.target.value })}
                >
                  {['Modern Villa', 'Duplex Residence', 'Executive Bungalow', 'Commercial Complex', 'Eco-Lodge'].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    )
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Storeys / Floors</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    className={inputClass}
                    value={aiForm.floors}
                    onChange={(e) => setAiForm({ ...aiForm, floors: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Bedrooms</label>
                  <select
                    className={inputClass}
                    value={aiForm.bedrooms}
                    onChange={(e) => setAiForm({ ...aiForm, bedrooms: parseInt(e.target.value) || 3 })}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Bedrooms
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Architectural Style</label>
                <select
                  className={inputClass}
                  value={aiForm.style}
                  onChange={(e) => setAiForm({ ...aiForm, style: e.target.value })}
                >
                  {[
                    'Tropical Contemporary',
                    'Modern Minimalist',
                    'Brutalist & Exposed Concrete',
                    'Industrial Loft',
                    'Neo-Classical Villa',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Design Requirements & Features</label>
                <textarea
                  className={`${inputClass} h-20 resize-none`}
                  placeholder="e.g. Master suite with cantilevered balcony, open-plan living room, swimming pool, shaded verandas..."
                  value={aiForm.customPrompt}
                  onChange={(e) => setAiForm({ ...aiForm, customPrompt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
              <button onClick={() => setAiModalOpen(false)} className={btnGhost}>
                Cancel
              </button>
              <button
                onClick={generateWithAI}
                disabled={generating}
                className="bg-[#315C4C] hover:bg-[#264B3E] text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                {generating ? 'Synthesizing with Gemini…' : 'Generate 3D Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
