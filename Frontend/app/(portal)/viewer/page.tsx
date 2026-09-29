'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { toast } from 'sonner';
import type { RoomSpec } from '@/Frontend/components/viewer/BuildingScene';

const BuildingScene = dynamic(
  () => import('@/Frontend/components/viewer/BuildingScene').then((m) => m.BuildingScene),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-on-surface-variant">Loading 3D viewer…</div> }
);

const SAMPLE_ROOMS: RoomSpec[] = [
  { name: 'Living', w: 6.0, h: 4.8, x: 0, y: 0 },
  { name: 'Kitchen', w: 3.8, h: 3.2, x: 6.6, y: 0 },
  { name: 'Master', w: 4.4, h: 4.2, x: 0, y: 5.4 },
  { name: 'Bedroom', w: 3.4, h: 3.4, x: 5.0, y: 5.4 },
  { name: 'Bath', w: 2.4, h: 2.2, x: 9.0, y: 5.4 },
];

const PRESETS = [
  { label: 'Concrete', color: '#b8c4be', metalness: 0.25, roughness: 0.6 },
  { label: 'Steel', color: '#9aa5a1', metalness: 0.85, roughness: 0.35 },
  { label: 'Timber', color: '#c59a6b', metalness: 0.05, roughness: 0.8 },
  { label: 'Glass', color: '#a9d6e5', metalness: 0.1, roughness: 0.1 },
];

export default function ViewerPage() {
  const [height, setHeight] = useState(3);
  const [preset, setPreset] = useState(PRESETS[0]);

  const exportImage = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      toast.error('Viewer not ready yet');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'buildsmart-3d-export.png';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image exported');
    }, 'image/png');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex flex-wrap items-center justify-between gap-4 px-margin-mobile md:px-margin-desktop py-4 border-b border-outline-variant dark:border-outline bg-[#FAFAF8] dark:bg-[#17201e]">
        <div>
          <h1 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest">3D Visualization</h1>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Drag to rotate · scroll to zoom · right-drag to pan</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-label-md text-on-surface-variant dark:text-surface-variant">Material</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPreset(p)}
                className={`text-label-md px-3 py-1.5 rounded-lg border transition-colors ${preset.label === p.label ? 'bg-primary-container text-on-primary-container dark:bg-primary-fixed-dim dark:text-on-primary-fixed border-transparent' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportImage} className="btn-primary px-4 py-2 rounded-lg text-label-md inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span> Export Image
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-[#f6f7f7] dark:bg-[#131e1b]">
        <BuildingScene rooms={SAMPLE_ROOMS} height={height} color={preset.color} metalness={preset.metalness} roughness={preset.roughness} />

        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-black/60 backdrop-blur rounded-lg p-3 border border-outline-variant dark:border-outline w-56">
          <span className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-2">Wall height: {height.toFixed(1)} m</span>
          <input type="range" min={1} max={6} step={0.5} value={height} onChange={(e) => setHeight(parseFloat(e.target.value))} className="w-full accent-[#315C4C]" />
          <span className="block text-label-md text-on-surface-variant dark:text-surface-variant mt-3">
            Floor plan: {SAMPLE_ROOMS.length} rooms · schematic walls generated from room footprints
          </span>
        </div>
      </div>
    </div>
  );
}
