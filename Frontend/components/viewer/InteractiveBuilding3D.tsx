'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Html } from '@react-three/drei';
import type { Floor3D, Plan3DResult, Room3D, RoomType } from '@/Backend/lib/ai-plan-generator';

export type MaterialPresetKey = 'concrete' | 'timber' | 'stucco' | 'steel' | 'brick';

export const MATERIAL_PRESETS: Record<
  MaterialPresetKey,
  { label: string; wallColor: string; floorColor: string; metalness: number; roughness: number }
> = {
  stucco: { label: 'Modern Stucco', wallColor: '#E8ECE9', floorColor: '#D3D8D5', metalness: 0.1, roughness: 0.8 },
  concrete: { label: 'Architectural Concrete', wallColor: '#A8B3AE', floorColor: '#8C9792', metalness: 0.25, roughness: 0.65 },
  timber: { label: 'Warm Timber & Stone', wallColor: '#C4A482', floorColor: '#967251', metalness: 0.05, roughness: 0.85 },
  steel: { label: 'Industrial Steel & Charcoal', wallColor: '#4A5552', floorColor: '#333D3A', metalness: 0.65, roughness: 0.4 },
  brick: { label: 'Terracotta & Clay Brick', wallColor: '#B86851', floorColor: '#8C4D3B', metalness: 0.1, roughness: 0.9 },
};

type InteractiveBuilding3DProps = {
  plan?: Plan3DResult | null;
  rooms?: Room3D[];
  floors?: Floor3D[];
  initialHeight?: number;
  showControlsBar?: boolean;
  onRoomSelect?: (room: Room3D) => void;
};

function FloorMesh({
  floor,
  wallHeight,
  isTopFloor,
  cutaway,
  materialPreset,
  showLabels,
  onRoomSelect,
}: {
  floor: Floor3D;
  wallHeight: number;
  isTopFloor: boolean;
  cutaway: boolean;
  materialPreset: MaterialPresetKey;
  showLabels: boolean;
  onRoomSelect?: (room: Room3D) => void;
}) {
  const preset = MATERIAL_PRESETS[materialPreset] || MATERIAL_PRESETS.stucco;
  const thick = 0.18;
  const elev = floor.elevation;

  const geometries = useMemo(() => {
    const wallBoxes: { pos: [number, number, number]; size: [number, number, number]; isGlass?: boolean }[] = [];
    const floorSlabs: { pos: [number, number, number]; size: [number, number, number]; isWater?: boolean; color?: string; room: Room3D }[] = [];
    const railings: { pos: [number, number, number]; size: [number, number, number] }[] = [];

    floor.rooms.forEach((r) => {
      const x0 = r.x;
      const y0 = r.y;
      const x1 = r.x + r.w;
      const y1 = r.y + r.h;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;

      const isWater = r.type === 'pool' || r.material === 'water';
      const isBalcony = r.type === 'balcony';
      const isTerrace = r.type === 'terrace';

      // Floor slab
      floorSlabs.push({
        pos: [cx, elev + 0.06, cy],
        size: [r.w, 0.12, r.h],
        isWater,
        color: isWater ? '#0284C7' : r.color,
        room: r,
      });

      if (isWater) {
        // Pool perimeter walls only (lower height)
        wallBoxes.push({ pos: [x0, elev + 0.2, cy], size: [thick, 0.4, r.h] });
        wallBoxes.push({ pos: [x1, elev + 0.2, cy], size: [thick, 0.4, r.h] });
        wallBoxes.push({ pos: [cx, elev + 0.2, y0], size: [r.w, 0.4, thick] });
        wallBoxes.push({ pos: [cx, elev + 0.2, y1], size: [r.w, 0.4, thick] });
        return;
      }

      if (isBalcony || isTerrace) {
        // Glass / steel railing around perimeter
        const railH = 1.1;
        railings.push({ pos: [x0, elev + railH / 2, cy], size: [0.04, railH, r.h] });
        railings.push({ pos: [x1, elev + railH / 2, cy], size: [0.04, railH, r.h] });
        railings.push({ pos: [cx, elev + railH / 2, y1], size: [r.w, railH, 0.04] });
        return;
      }

      // Standard room perimeter walls
      const wallY = elev + wallHeight / 2;

      // West wall
      wallBoxes.push({ pos: [x0, wallY, cy], size: [thick, wallHeight, r.h] });
      // East wall
      wallBoxes.push({ pos: [x1, wallY, cy], size: [thick, wallHeight, r.h] });
      // North wall
      wallBoxes.push({ pos: [cx, wallY, y0], size: [r.w, wallHeight, thick] });
      // South wall (leave gap for circulation/windows on south)
      const hasLargeOpening = r.type === 'living' || r.features?.includes('large_openings');
      if (hasLargeOpening) {
        // Half wall + window pane
        wallBoxes.push({ pos: [cx, elev + wallHeight * 0.2, y1], size: [r.w, wallHeight * 0.4, thick] });
        wallBoxes.push({ pos: [cx, elev + wallHeight * 0.65, y1], size: [r.w, wallHeight * 0.5, 0.06], isGlass: true });
      } else {
        wallBoxes.push({ pos: [cx, wallY, y1], size: [r.w, wallHeight, thick] });
      }
    });

    // Ceiling / Roof Slab if not cutaway or not top floor
    const shouldRenderCeiling = !cutaway || !isTopFloor;
    let ceilingSlab: { pos: [number, number, number]; size: [number, number, number] } | null = null;
    if (shouldRenderCeiling && floor.rooms.length > 0) {
      const minX = Math.min(...floor.rooms.map((r) => r.x));
      const maxX = Math.max(...floor.rooms.map((r) => r.x + r.w));
      const minY = Math.min(...floor.rooms.map((r) => r.y));
      const maxY = Math.max(...floor.rooms.map((r) => r.y + r.h));
      const totalW = maxX - minX + 0.4;
      const totalH = maxY - minY + 0.4;
      ceilingSlab = {
        pos: [(minX + maxX) / 2, elev + wallHeight + 0.06, (minY + maxY) / 2],
        size: [totalW, 0.12, totalH],
      };
    }

    return { wallBoxes, floorSlabs, railings, ceilingSlab };
  }, [floor, wallHeight, isTopFloor, cutaway, elev]);

  return (
    <group>
      {/* Floor Slabs */}
      {geometries.floorSlabs.map((slab, i) => (
        <mesh
          key={`slab-${i}`}
          position={slab.pos}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            onRoomSelect?.(slab.room);
          }}
        >
          <boxGeometry args={slab.size} />
          {slab.isWater ? (
            <meshStandardMaterial color="#0284C7" metalness={0.3} roughness={0.1} opacity={0.8} transparent />
          ) : (
            <meshStandardMaterial color={preset.floorColor} metalness={preset.metalness} roughness={preset.roughness} />
          )}
        </mesh>
      ))}

      {/* Solid Walls */}
      {geometries.wallBoxes.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos} castShadow receiveShadow>
          <boxGeometry args={w.size} />
          {w.isGlass ? (
            <meshStandardMaterial color="#7DD3FC" metalness={0.9} roughness={0.1} opacity={0.45} transparent />
          ) : (
            <meshStandardMaterial color={preset.wallColor} metalness={preset.metalness} roughness={preset.roughness} />
          )}
        </mesh>
      ))}

      {/* Railings */}
      {geometries.railings.map((r, i) => (
        <mesh key={`rail-${i}`} position={r.pos}>
          <boxGeometry args={r.size} />
          <meshStandardMaterial color="#38BDF8" metalness={0.8} roughness={0.2} opacity={0.4} transparent />
        </mesh>
      ))}

      {/* Ceiling / Floor Separator Slab */}
      {geometries.ceilingSlab && (
        <mesh position={geometries.ceilingSlab.pos} receiveShadow castShadow>
          <boxGeometry args={geometries.ceilingSlab.size} />
          <meshStandardMaterial color={preset.wallColor} metalness={preset.metalness} roughness={preset.roughness} />
        </mesh>
      )}

      {/* Floating 3D Room Badges */}
      {showLabels &&
        floor.rooms.map((r) => (
          <Html
            key={`label-${r.id}`}
            position={[r.x + r.w / 2, elev + 0.35, r.y + r.h / 2]}
            center
            distanceFactor={18}
            className="pointer-events-none select-none"
          >
            <div className="bg-white/95 dark:bg-[#131e1b]/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-md border border-outline-variant/60 text-center whitespace-nowrap">
              <p className="text-[11px] font-semibold text-primary dark:text-inverse-primary leading-tight">{r.name}</p>
              <p className="text-[9px] text-on-surface-variant font-mono-technical">
                {r.w.toFixed(1)}m × {r.h.toFixed(1)}m ({(r.w * r.h).toFixed(0)}m²)
              </p>
            </div>
          </Html>
        ))}
    </group>
  );
}

export function InteractiveBuilding3D({
  plan,
  rooms,
  floors,
  initialHeight = 3.0,
  showControlsBar = true,
  onRoomSelect,
}: InteractiveBuilding3DProps) {
  const [wallHeight, setWallHeight] = useState(initialHeight);
  const [cutaway, setCutaway] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [materialPreset, setMaterialPreset] = useState<MaterialPresetKey>('stucco');
  const [activeFloorIndex, setActiveFloorIndex] = useState<number | 'all'>('all');
  const controlsRef = useRef<any>(null);

  // Derive standardized floors list
  const resolvedFloors: Floor3D[] = useMemo(() => {
    if (plan?.floors && plan.floors.length > 0) return plan.floors;
    if (floors && floors.length > 0) return floors;
    if (rooms && rooms.length > 0) {
      return [
        {
          floorIndex: 0,
          name: 'Ground Floor',
          elevation: 0,
          height: wallHeight,
          rooms,
        },
      ];
    }
    // Fallback sample
    return [
      {
        floorIndex: 0,
        name: 'Ground Floor',
        elevation: 0,
        height: wallHeight,
        rooms: [
          { id: 'r1', name: 'Living Room', type: 'living', w: 6.5, h: 5.0, x: 0, y: 0, color: '#315C4C' },
          { id: 'r2', name: 'Kitchen & Dining', type: 'kitchen', w: 4.5, h: 5.0, x: 6.7, y: 0, color: '#D97706' },
          { id: 'r3', name: 'Master Suite', type: 'bedroom', w: 5.0, h: 4.5, x: 0, y: 5.3, color: '#2A7A64' },
          { id: 'r4', name: 'Bedroom 2', type: 'bedroom', w: 3.8, h: 4.0, x: 5.2, y: 5.3, color: '#2A7A64' },
          { id: 'r5', name: 'Terrace & Pool', type: 'pool', w: 5.0, h: 3.0, x: 0, y: -3.3, color: '#38BDF8' },
        ],
      },
    ];
  }, [plan, floors, rooms, wallHeight]);

  const visibleFloors = useMemo(() => {
    if (activeFloorIndex === 'all') return resolvedFloors;
    return resolvedFloors.filter((f) => f.floorIndex === activeFloorIndex);
  }, [resolvedFloors, activeFloorIndex]);

  const resetCamera = () => {
    controlsRef.current?.reset();
  };

  const setViewAngle = (angle: 'iso' | 'top' | 'front') => {
    if (!controlsRef.current) return;
    if (angle === 'top') {
      controlsRef.current.object.position.set(0, 32, 0.001);
    } else if (angle === 'front') {
      controlsRef.current.object.position.set(0, 4, 26);
    } else {
      // Isometric 45
      controlsRef.current.object.position.set(16, 14, 16);
    }
    controlsRef.current.target.set(4, 2, 4);
    controlsRef.current.update();
  };

  const exportSnapshot = () => {
    const canvas = document.querySelector('#interactive-building-canvas canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plan?.projectName ?? 'buildsmart-3d-plan').toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full min-h-[460px] flex flex-col bg-[#F3F4F3] dark:bg-[#111917] overflow-hidden rounded-xl border border-outline-variant/40">
      {/* 3D Scene Viewport */}
      <div id="interactive-building-canvas" className="flex-1 w-full h-full relative">
        <Canvas
          camera={{ position: [16, 14, 16], fov: 45 }}
          shadows
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[14, 22, 10]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-10, 12, -10]} intensity={0.4} />

          <group position={[-3, 0, -3]}>
            {visibleFloors.map((fl, idx) => (
              <FloorMesh
                key={`floor-${fl.floorIndex}`}
                floor={fl}
                wallHeight={wallHeight}
                isTopFloor={idx === visibleFloors.length - 1}
                cutaway={cutaway}
                materialPreset={materialPreset}
                showLabels={showLabels}
                onRoomSelect={onRoomSelect}
              />
            ))}
          </group>

          <Grid
            infiniteGrid
            fadeDistance={70}
            sectionColor="#315C4C"
            sectionSize={5}
            cellColor="#C8D0CC"
            cellSize={1}
            position={[0, -0.01, 0]}
          />
          <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={45} blur={2.2} far={12} />
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={4}
            maxDistance={60}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>

        {/* Floating Quick Action Overlay (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 dark:bg-inverse-surface/90 backdrop-blur-md px-2 py-1.5 rounded-lg border border-outline-variant/50 shadow-sm z-10">
          <button
            onClick={() => setViewAngle('iso')}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-surface-container-low text-on-surface dark:text-inverse-on-surface"
            title="Isometric 45°"
          >
            3D Iso
          </button>
          <button
            onClick={() => setViewAngle('top')}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-surface-container-low text-on-surface dark:text-inverse-on-surface"
            title="Top-Down Plan"
          >
            Plan View
          </button>
          <button
            onClick={() => setViewAngle('front')}
            className="px-2 py-1 text-xs font-medium rounded hover:bg-surface-container-low text-on-surface dark:text-inverse-on-surface"
            title="Front Elevation"
          >
            Elevation
          </button>
          <span className="h-4 w-px bg-outline-variant/60 mx-0.5" />
          <button
            onClick={resetCamera}
            className="p-1 rounded hover:bg-surface-container-low text-on-surface dark:text-inverse-on-surface"
            title="Reset Camera"
          >
            <span className="material-symbols-outlined text-[17px]">restart_alt</span>
          </button>
          <button
            onClick={exportSnapshot}
            className="p-1 rounded hover:bg-surface-container-low text-primary dark:text-inverse-primary"
            title="Export PNG Snapshot"
          >
            <span className="material-symbols-outlined text-[17px]">photo_camera</span>
          </button>
        </div>

        {/* Floating Floor Selector (Top Left) */}
        {resolvedFloors.length > 1 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 dark:bg-inverse-surface/90 backdrop-blur-md p-1 rounded-lg border border-outline-variant/50 shadow-sm z-10">
            <button
              onClick={() => setActiveFloorIndex('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                activeFloorIndex === 'all'
                  ? 'bg-primary text-white dark:bg-inverse-primary dark:text-on-primary-fixed'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              All Floors ({resolvedFloors.length})
            </button>
            {resolvedFloors.map((fl) => (
              <button
                key={fl.floorIndex}
                onClick={() => setActiveFloorIndex(fl.floorIndex)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                  activeFloorIndex === fl.floorIndex
                    ? 'bg-primary text-white dark:bg-inverse-primary dark:text-on-primary-fixed'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {fl.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Interactive Toolbar */}
      {showControlsBar && (
        <div className="border-t border-outline-variant/40 bg-white/95 dark:bg-inverse-surface/95 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
          {/* Material Swatches */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface dark:text-inverse-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">palette</span>
              Theme:
            </span>
            {(Object.keys(MATERIAL_PRESETS) as MaterialPresetKey[]).map((key) => {
              const p = MATERIAL_PRESETS[key];
              return (
                <button
                  key={key}
                  onClick={() => setMaterialPreset(key)}
                  className={`px-2 py-1 rounded border transition-all flex items-center gap-1.5 ${
                    materialPreset === key
                      ? 'border-primary bg-primary/10 text-primary font-semibold dark:border-inverse-primary dark:text-inverse-primary'
                      : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: p.wallColor }} />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Slicing, Wall Height & Label Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-on-surface dark:text-inverse-on-surface font-medium">
              <input
                type="checkbox"
                checked={cutaway}
                onChange={(e) => setCutaway(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Dollhouse Cutaway</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-on-surface dark:text-inverse-on-surface font-medium">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>3D Room Pins</span>
            </label>

            <div className="flex items-center gap-2 border-l border-outline-variant/60 pl-3">
              <span className="text-on-surface-variant">Height: {wallHeight.toFixed(1)}m</span>
              <input
                type="range"
                min={2.4}
                max={4.8}
                step={0.2}
                value={wallHeight}
                onChange={(e) => setWallHeight(parseFloat(e.target.value))}
                className="w-20 accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
