'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import { useMemo } from 'react';

export type RoomSpec = { name: string; w: number; h: number; x: number; y: number };

function Building({ rooms, height, color, metalness, roughness }: { rooms: RoomSpec[]; height: number; color: string; metalness: number; roughness: number }) {
  const geometry = useMemo(() => {
    // Convert rooms into a set of 3D "walls" (boxes) forming a schematic building.
    const walls: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const thick = 0.18;
    rooms.forEach((r) => {
      const x0 = r.x;
      const y0 = r.y;
      const x1 = r.x + r.w;
      const y1 = r.y + r.h;
      // Floor slab
      walls.push({ pos: [(x0 + x1) / 2, 0, (y0 + y1) / 2], size: [r.w, 0.12, r.h] });
      // Perimeter walls
      walls.push({ pos: [x0, height / 2, (y0 + y1) / 2], size: [thick, height, r.h] });
      walls.push({ pos: [x1, height / 2, (y0 + y1) / 2], size: [thick, height, r.h] });
      walls.push({ pos: [(x0 + x1) / 2, height / 2, y0], size: [r.w, height, thick] });
      walls.push({ pos: [(x0 + x1) / 2, height / 2, y1], size: [r.w, height, thick] });
    });
    return walls;
  }, [rooms, height]);

  return (
    <group>
      {geometry.map((w, i) => (
        <mesh key={i} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
      ))}
    </group>
  );
}

export function BuildingScene({
  rooms,
  height = 3,
  color = '#b8c4be',
  metalness = 0.25,
  roughness = 0.6,
}: {
  rooms: RoomSpec[];
  height?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <Canvas camera={{ position: [14, 12, 14], fov: 45 }} shadows dpr={[1, 2]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 18, 8]} intensity={1.2} castShadow />
      <Building rooms={rooms} height={height} color={color} metalness={metalness} roughness={roughness} />
      <Grid infiniteGrid fadeDistance={60} sectionColor="#dde2e0" cellColor="#eef1ef" position={[0, -0.01, 0]} />
      <ContactShadows position={[0, -0.02, 0]} opacity={0.35} scale={40} blur={2.5} far={10} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={6} maxDistance={50} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}
