'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Field, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

type Room = { name: string; w: number; h: number; x: number; y: number };

type Form = { buildingType: string; floors: number; bedrooms: number; bathrooms: number; style: string; budget: number };

const STYLES = ['Modern Minimalist', 'Modern Tropical', 'Contemporary', 'Industrial Loft', 'Traditional Craftsman', 'Coastal'];
const TYPES = ['Residential', 'Commercial', 'Office', 'Villa', 'Duplex', 'Bungalow', 'Hotel', 'School', 'Industrial', 'Custom'];

function buildLayout(f: Form): Room[] {
  const rooms: Omit<Room, 'x' | 'y'>[] = [
    { name: 'Living Room', w: 6, h: 4.8 }, { name: 'Kitchen', w: 3.8, h: 3.2 }, { name: 'Dining', w: 3.6, h: 3 },
  ];
  for (let i = 0; i < f.bedrooms; i++) rooms.push(i === 0 ? { name: 'Master Bedroom', w: 4.4, h: 4.2 } : { name: `Bedroom ${i}`, w: 3.4, h: 3.4 });
  for (let i = 0; i < f.bathrooms; i++) rooms.push(i === 0 ? { name: 'Master Bath', w: 2.4, h: 2.2 } : { name: `Bathroom ${i}`, w: 2.4, h: 2.2 });
  rooms.push({ name: 'Hallway', w: 1.8, h: 6 });
  const gap = 0.6, colW = Math.max(...rooms.map((r) => r.w)) + gap, colH = Math.max(...rooms.map((r) => r.h)) + gap;
  return rooms.map((r, i) => ({ ...r, x: (i % 2) * colW, y: Math.floor(i / 2) * colH }));
}

const S = 40; // px per meter

export default function ArchitectStudioPage() {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [form, setForm] = useState<Form>({ buildingType: 'Residential', floors: 2, bedrooms: 3, bathrooms: 2, style: 'Modern Tropical', budget: 2 });
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');

  const areaM2 = useMemo(() => Math.round((rooms ?? []).reduce((s, r) => s + r.w * r.h, 0) * form.floors), [rooms, form.floors]);
  const estCost = useMemo(() => areaM2 * ([45000, 65000, 90000, 130000][form.budget - 1] ?? 65000), [areaM2, form.budget]);
  const gridW = rooms ? Math.max(...rooms.map((r) => r.x + r.w)) + 1 : 20;
  const gridH = rooms ? Math.max(...rooms.map((r) => r.y + r.h)) + 1 : 20;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setRooms(buildLayout(form));
      setGenerating(false);
      toast.success('AI layout generated');
    }, 900);
  };

  const saveDesign = async () => {
    if (!rooms) return toast.error('Generate a layout first');
    setSaving(true);
    try {
      await api('POST', '/api/architect/designs', {
        name: `${form.buildingType} — ${form.style} (${form.bedrooms}BR)`,
        category: form.buildingType,
        type: 'concept',
        projectId: projectId || null,
        aiGenerated: true,
        thumbnail: '/images/project-floorplan.png',
        tags: [form.style, form.buildingType],
        requirements: { bedrooms: form.bedrooms, bathrooms: form.bathrooms, floors: form.floors, style: form.style },
      });
      if (projectId) {
        await api('POST', '/api/architect/floorplans', {
          projectId,
          name: `${form.buildingType} — AI layout`,
          data: { rooms, form },
          svgData: 'ai-generated',
        });
      }
      toast.success('Design saved to library');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="AI Design Studio" subtitle="Generate architectural designs from text requirements." crumbs={['Architect', 'Design Studio', 'AI Design Studio']} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 space-y-4 self-start">
          <Field label="Building Type">
            <select className={inputClass} value={form.buildingType} onChange={(e) => set('buildingType', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Floors"><input className={inputClass} type="number" min={1} max={100} value={form.floors} onChange={(e) => set('floors', Math.max(1, parseInt(e.target.value) || 1))} /></Field>
            <Field label="Bedrooms"><input className={inputClass} type="number" min={1} max={20} value={form.bedrooms} onChange={(e) => set('bedrooms', Math.max(1, parseInt(e.target.value) || 1))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bathrooms"><input className={inputClass} type="number" min={1} max={10} value={form.bathrooms} onChange={(e) => set('bathrooms', Math.max(1, parseInt(e.target.value) || 1))} /></Field>
            <Field label="Budget Tier">
              <select className={inputClass} value={form.budget} onChange={(e) => set('budget', parseInt(e.target.value))}>
                {['Economy', 'Standard', 'Premium', 'Luxury'].map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Architectural Style">
            <select className={inputClass} value={form.style} onChange={(e) => set('style', e.target.value)}>{STYLES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Link to Project (optional)">
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Standalone design</option>
              {(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <button className={btnPrimary + ' w-full py-3'} onClick={generate} disabled={generating}>
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {generating ? 'Generating…' : 'Generate AI Layout'}
          </button>

          <div className="bg-surface-container-low dark:bg-surface-variant rounded-lg p-3 font-mono-technical text-body-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-on-surface-variant dark:text-surface-variant">Est. Area</span><span className="font-semibold text-on-surface dark:text-inverse-on-surface">{rooms ? `${areaM2.toLocaleString()} m²` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant dark:text-surface-variant">Est. Cost</span><span className="font-semibold text-on-surface dark:text-inverse-on-surface">{rooms ? `${estCost.toLocaleString()} XAF` : '—'}</span></div>
            <p className="text-[11px] text-on-surface-variant dark:text-surface-variant">Schematic estimate — not an engineering approval.</p>
          </div>

          {rooms && (
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} disabled={saving} onClick={saveDesign}>{saving ? 'Saving…' : 'Save to Library'}</button>
            </div>
          )}
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">info</span>AI-generated designs are marked as AI-generated and are not automatically structurally safe or legally approved.</p>
        </Card>

        <div className="lg:col-span-2">
          <Card pad={false} className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant dark:border-outline">
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Layout Preview</h3>
              <span className="text-label-md font-mono-technical text-on-surface-variant dark:text-surface-variant">SCALE 1:100</span>
            </div>
            <div className="relative overflow-auto p-6" style={{ minHeight: 420 }}>
              {!rooms ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant dark:text-surface-variant">
                  <span className="material-symbols-outlined text-[64px] mb-2">grid_on</span>
                  <p>Enter requirements and generate a layout.</p>
                </div>
              ) : (
                <svg viewBox={`0 0 ${gridW * S} ${gridH * S}`} style={{ width: gridW * S, maxWidth: '100%', height: 'auto' }} role="img" aria-label="Generated floor plan">
                  <rect width={gridW * S} height={gridH * S} fill="#EAF7F1" />
                  {rooms.map((r, i) => (
                    <g key={i}>
                      <rect x={r.x * S} y={r.y * S} width={r.w * S} height={r.h * S} fill="#fff" stroke="#315C4C" strokeWidth={2} rx={2} />
                      <text x={r.x * S + 6} y={r.y * S + 16} fontSize={11} fill="#315C4C" fontWeight={600}>{r.name}</text>
                      <text x={r.x * S + 6} y={r.y * S + 30} fontSize={10} fill="#5c6f68">{r.w.toFixed(1)}×{r.h.toFixed(1)}m</text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant dark:border-outline">
              <span className="text-body-sm text-on-surface-variant dark:text-surface-variant">{rooms ? `${rooms.length} rooms · ${areaM2.toLocaleString()} m²` : ''}</span>
              {rooms && (
                <div className="flex gap-2">
                  <a href="/architect/floorplans" className={btnGhost}><span className="material-symbols-outlined text-[18px]">edit_square</span>Open in 2D Editor</a>
                  <a href="/architect/3d" className={btnGhost}><span className="material-symbols-outlined text-[18px]">view_in_ar</span>3D View</a>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
