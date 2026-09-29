// BuildSmart AI — Architectural 3D Isometric Cutaway & Presentation Generator
// Generates CAD-grade 3D isometric cutaway visualizations and colorized architectural plans (SVG)
// directly from the Gemini-extracted room layout, dimensions, and architectural topology.

import type { RoomLayoutSpec, FloorPlanGenerationOptions } from './floorplan-2d-generator.ts';

export interface VisualizationOptions extends FloorPlanGenerationOptions {
  renderMode?: 'isometric_cutaway' | 'presentation_colorized';
  wallHeight?: number;
  cameraAngle?: 'south_west' | 'south_east';
  lighting?: 'daylight' | 'dusk_warm' | 'studio_neutral';
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * Isometric Projection Converter
 * Standard 30-degree isometric projection with configurable origin and scale.
 */
class IsometricCamera {
  private originX: number;
  private originY: number;
  private scaleX: number;
  private scaleY: number;
  private cos30: number = Math.cos(Math.PI / 6); // ~0.866
  private sin30: number = Math.sin(Math.PI / 6); // 0.5

  constructor(originX: number, originY: number, scaleX: number = 1, scaleY: number = 1) {
    this.originX = originX;
    this.originY = originY;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
  }

  project(p: Point3D): Point2D {
    // x extends down-right, y extends down-left, z extends straight up
    const px = (p.x - p.y) * this.cos30 * this.scaleX;
    const py = (p.x + p.y) * this.sin30 * this.scaleY - p.z;
    return {
      x: this.originX + px,
      y: this.originY + py,
    };
  }

  projectFlat(x: number, y: number, z: number = 0): Point2D {
    return this.project({ x, y, z });
  }

  polyStr(points: Point3D[]): string {
    return points.map((p) => {
      const pt = this.project(p);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }).join(' ');
  }
}

/**
 * Generates an architectural 3D Isometric Cutaway Visualization in SVG.
 * Features:
 * - Axonometric isometric projection
 * - Sectional cutaway: back walls full height, front walls cut low for unobstructed view
 * - Textured floor slabs tailored to room function (hardwood, porcelain tile, marble)
 * - 3D procedural furniture (sectional sofas, beds, kitchen islands, vanity units, desks)
 * - Ambient lighting, drop shadows, window light beams
 * - Floating glassmorphic 3D room label badges with dimensions
 * - Professional title block and compass rose
 */
export function generate3DVisualizationSVG(
  rooms: RoomLayoutSpec[],
  options: VisualizationOptions = {}
): string {
  const width = 1600;
  const height = 1200;
  const title = options.title || '3D Isometric Architectural Cutaway';
  const subtitle = options.subtitle || 'Synthesized from Architectural Blueprint Analysis';
  const wallHeight = options.wallHeight || 110;
  const cutawayHeight = 28; // Front walls cut low so interior is visible
  const dateStr = new Date().toISOString().split('T')[0];

  // Ground plane bounding box
  const modelWidth = 720;
  const modelDepth = 520;
  const originX = width / 2;
  const originY = height / 2 - 30;
  const camera = new IsometricCamera(originX, originY, 1, 1);

  // Normalize room coordinates into model space (0..modelWidth, 0..modelDepth)
  const normRooms = rooms.map((r) => {
    const rx = (r.bounds.x / 100) * modelWidth - modelWidth / 2;
    const ry = (r.bounds.y / 100) * modelDepth - modelDepth / 2;
    const rw = Math.max(70, (r.bounds.w / 100) * modelWidth);
    const rh = Math.max(70, (r.bounds.h / 100) * modelDepth);
    return {
      ...r,
      rx,
      ry,
      rw,
      rh,
      x2: rx + rw,
      y2: ry + rh,
      cx: rx + rw / 2,
      cy: ry + rh / 2,
    };
  });

  // Calculate overall bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  normRooms.forEach((r) => {
    if (r.rx < minX) minX = r.rx;
    if (r.ry < minY) minY = r.ry;
    if (r.x2 > maxX) maxX = r.x2;
    if (r.y2 > maxY) maxY = r.y2;
  });

  // Sort rooms from back (lowest x+y in isometric) to front (highest x+y) for correct painter's algorithm
  const sortedRooms = [...normRooms].sort((a, b) => (a.rx + a.ry) - (b.rx + b.ry));

  // Build SVG Content
  const svgParts: string[] = [];

  // 1. Header & Definitions
  svgParts.push(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #0b0f19; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#0f172a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#050811" stop-opacity="1"/>
    </radialGradient>

    <!-- Wall Lighting Gradients -->
    <linearGradient id="wallLightLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="wallLightRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <linearGradient id="wallBackShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>

    <!-- Floor Texture: Warm Hardwood Planks -->
    <pattern id="woodPlankPattern" width="30" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="30" height="15" fill="#c29b74"/>
      <rect x="0" y="0" width="30" height="7.5" fill="#b88d64" stroke="#9e754f" stroke-width="0.7"/>
      <rect x="0" y="7.5" width="30" height="7.5" fill="#c9a47e" stroke="#9e754f" stroke-width="0.7"/>
      <line x1="15" y1="0" x2="15" y2="7.5" stroke="#9e754f" stroke-width="0.7"/>
      <line x1="25" y1="7.5" x2="25" y2="15" stroke="#9e754f" stroke-width="0.7"/>
    </pattern>

    <!-- Floor Texture: Marble / Slate Tiles -->
    <pattern id="tilePattern" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="20" height="20" fill="#334155"/>
      <rect width="19" height="19" fill="#475569" stroke="#1e293b" stroke-width="1"/>
    </pattern>

    <!-- Floor Texture: Polished Concrete / Kitchen Porcelain -->
    <pattern id="lightTilePattern" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="24" height="24" fill="#e2e8f0"/>
      <rect width="23" height="23" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>
    </pattern>

    <!-- Floor Texture: Outdoor Patio Pavers -->
    <pattern id="paverPattern" width="28" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="28" height="18" fill="#52525b"/>
      <rect width="26" height="16" fill="#71717a" stroke="#3f3f46" stroke-width="1.2"/>
    </pattern>

    <!-- Ambient Shadow Filters -->
    <filter id="softShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="4" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="furnitureShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
    </filter>

    <!-- Glass Enclosure Gradient -->
    <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.15"/>
    </linearGradient>

    <!-- Window Light Shaft Gradient -->
    <linearGradient id="sunBeam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>

  <!-- Isometric Ground Grid -->
  <g opacity="0.15" stroke="#38bdf8" stroke-width="0.8">
`);

  // Subtle isometric ground grid lines under the building
  for (let gx = -600; gx <= 600; gx += 60) {
    const p1 = camera.projectFlat(gx, -600, -15);
    const p2 = camera.projectFlat(gx, 600, -15);
    svgParts.push(`    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`);
  }
  for (let gy = -600; gy <= 600; gy += 60) {
    const p1 = camera.projectFlat(-600, gy, -15);
    const p2 = camera.projectFlat(600, gy, -15);
    svgParts.push(`    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`);
  }
  svgParts.push(`  </g>`);

  // 2. Base Foundation Slab
  const slabMargin = 20;
  const slabP1 = camera.projectFlat(minX - slabMargin, minY - slabMargin, 0);
  const slabP2 = camera.projectFlat(maxX + slabMargin, minY - slabMargin, 0);
  const slabP3 = camera.projectFlat(maxX + slabMargin, maxY + slabMargin, 0);
  const slabP4 = camera.projectFlat(minX - slabMargin, maxY + slabMargin, 0);
  const slabBot2 = camera.projectFlat(maxX + slabMargin, minY - slabMargin, -16);
  const slabBot3 = camera.projectFlat(maxX + slabMargin, maxY + slabMargin, -16);
  const slabBot4 = camera.projectFlat(minX - slabMargin, maxY + slabMargin, -16);

  svgParts.push(`
  <!-- Foundation Slab & Cast Shadow -->
  <g filter="url(#softShadow)">
    <!-- Slab Top Face -->
    <polygon points="${slabP1.x},${slabP1.y} ${slabP2.x},${slabP2.y} ${slabP3.x},${slabP3.y} ${slabP4.x},${slabP4.y}"
      fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
    <!-- Slab Front-Right Edge -->
    <polygon points="${slabP2.x},${slabP2.y} ${slabP3.x},${slabP3.y} ${slabBot3.x},${slabBot3.y} ${slabBot2.x},${slabBot2.y}"
      fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
    <!-- Slab Front-Left Edge -->
    <polygon points="${slabP3.x},${slabP3.y} ${slabP4.x},${slabP4.y} ${slabBot4.x},${slabBot4.y} ${slabBot3.x},${slabBot3.y}"
      fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
  </g>
`);

  // 3. Room Floor Slabs with Real Materials
  svgParts.push(`  <!-- Room Floor Slabs -->`);
  sortedRooms.forEach((r) => {
    let fill = 'url(#woodPlankPattern)';
    if (r.type === 'kitchen') fill = 'url(#lightTilePattern)';
    else if (r.type === 'bath') fill = 'url(#tilePattern)';
    else if (r.type === 'balcony' || r.type === 'patio') fill = 'url(#paverPattern)';
    else if (r.type === 'garage' || r.type === 'utility') fill = '#475569';

    const pA = camera.projectFlat(r.rx, r.ry, 0);
    const pB = camera.projectFlat(r.x2, r.ry, 0);
    const pC = camera.projectFlat(r.x2, r.y2, 0);
    const pD = camera.projectFlat(r.rx, r.y2, 0);

    svgParts.push(`
    <g class="room-slab" data-room-id="${r.id}">
      <polygon points="${pA.x.toFixed(1)},${pA.y.toFixed(1)} ${pB.x.toFixed(1)},${pB.y.toFixed(1)} ${pC.x.toFixed(1)},${pC.y.toFixed(1)} ${pD.x.toFixed(1)},${pD.y.toFixed(1)}"
        fill="${fill}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    </g>`);
  });

  // 4. Back Walls (Full Extrusion Height)
  // Back walls are along the top and left of the building (minY and minX)
  svgParts.push(`  <!-- Back Perimeter Walls (Full Height) -->`);
  normRooms.forEach((r) => {
    // If room borders the top (minY), render back-top wall
    if (Math.abs(r.ry - minY) < 2) {
      render3DWall(svgParts, camera, r.rx, r.ry, r.x2, r.ry, wallHeight, 'north', r.windows);
    }
    // If room borders the left (minX), render back-left wall
    if (Math.abs(r.rx - minX) < 2) {
      render3DWall(svgParts, camera, r.rx, r.ry, r.rx, r.y2, wallHeight, 'west', r.windows);
    }
  });

  // 5. Interior Partition Walls (Full or 3/4 Height)
  svgParts.push(`  <!-- Interior Partition Walls -->`);
  normRooms.forEach((r) => {
    // Interior vertical wall between rooms
    if (r.x2 < maxX - 5) {
      render3DWall(svgParts, camera, r.x2, r.ry, r.x2, r.y2, wallHeight * 0.85, 'interior_y', undefined, r.doors);
    }
    // Interior horizontal wall between rooms
    if (r.y2 < maxY - 5) {
      render3DWall(svgParts, camera, r.rx, r.y2, r.x2, r.y2, wallHeight * 0.85, 'interior_x', undefined, r.doors);
    }
  });

  // 6. 3D Procedural Architectural Furniture
  svgParts.push(`  <!-- 3D Architectural Furniture Blocks -->`);
  sortedRooms.forEach((r) => {
    render3DFurniture(svgParts, camera, r);
  });

  // 7. Front Walls (Cutaway Low Profile for Clear Sightlines)
  svgParts.push(`  <!-- Front Sectional Cutaway Walls (Low Height for Sightlines) -->`);
  normRooms.forEach((r) => {
    // Front-right exterior wall (along maxX)
    if (Math.abs(r.x2 - maxX) < 2) {
      render3DWall(svgParts, camera, r.x2, r.ry, r.x2, r.y2, cutawayHeight, 'east');
    }
    // Front-bottom exterior wall (along maxY)
    if (Math.abs(r.y2 - maxY) < 2) {
      render3DWall(svgParts, camera, r.rx, r.y2, r.x2, r.y2, cutawayHeight, 'south');
    }
  });

  // 8. Floating 3D Architectural Room Badges
  svgParts.push(`  <!-- Floating Glassmorphic 3D Room Badges -->`);
  sortedRooms.forEach((r) => {
    const badgeZ = wallHeight + 35;
    const badgePt = camera.projectFlat(r.cx, r.cy, badgeZ);
    const floorPt = camera.projectFlat(r.cx, r.cy, 0);

    const roomTitle = r.name || r.type.toUpperCase();
    const dims = r.dimensions || `${Math.round(r.areaSqFt || 180)} sq ft`;
    const badgeW = Math.max(130, roomTitle.length * 9.5 + 24);

    svgParts.push(`
    <g class="room-badge" filter="url(#badgeShadow)">
      <!-- Anchor drop line to floor center -->
      <line x1="${badgePt.x.toFixed(1)}" y1="${badgePt.y.toFixed(1)}"
            x2="${floorPt.x.toFixed(1)}" y2="${floorPt.y.toFixed(1)}"
            stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.6"/>
      <!-- Small pulse circle on floor -->
      <circle cx="${floorPt.x.toFixed(1)}" cy="${floorPt.y.toFixed(1)}" r="3" fill="#38bdf8" opacity="0.75"/>

      <!-- Floating Pill Badge -->
      <rect x="${(badgePt.x - badgeW / 2).toFixed(1)}" y="${(badgePt.y - 18).toFixed(1)}"
            width="${badgeW}" height="36" rx="18"
            fill="rgba(15, 23, 42, 0.88)" stroke="#38bdf8" stroke-width="1.2"/>

      <!-- Room Name & Dimensions -->
      <text x="${badgePt.x.toFixed(1)}" y="${(badgePt.y - 3).toFixed(1)}"
            text-anchor="middle" font-size="11" font-weight="700" fill="#f8fafc" letter-spacing="0.5">
        ${escapeXml(roomTitle)}
      </text>
      <text x="${badgePt.x.toFixed(1)}" y="${(badgePt.y + 11).toFixed(1)}"
            text-anchor="middle" font-size="9.5" font-weight="500" fill="#94a3b8">
        ${escapeXml(dims)}
      </text>
    </g>`);
  });

  // 9. Modern Architectural Title Block & Viewport Frame
  svgParts.push(`
  <!-- Title Block & Architectural Border -->
  <g class="title-block">
    <!-- Outer Border -->
    <rect x="30" y="30" width="${width - 60}" height="${height - 60}"
          fill="none" stroke="#334155" stroke-width="1.5" rx="8"/>
    <rect x="38" y="38" width="${width - 76}" height="${height - 76}"
          fill="none" stroke="#1e293b" stroke-width="1" rx="6"/>

    <!-- Bottom Header Card -->
    <rect x="50" y="${height - 110}" width="${width - 100}" height="70"
          fill="rgba(15, 23, 42, 0.92)" stroke="#334155" stroke-width="1.2" rx="6"/>

    <!-- Title & Typology -->
    <text x="80" y="${height - 76}" font-size="19" font-weight="700" fill="#f8fafc" letter-spacing="0.5">
      ${escapeXml(title.toUpperCase())}
    </text>
    <text x="80" y="${height - 54}" font-size="12" font-weight="400" fill="#94a3b8">
      ${escapeXml(subtitle)} • ${rooms.length} Detected Functional Zones
    </text>

    <!-- Metadata Badges -->
    <g transform="translate(${width - 450}, ${height - 90})">
      <rect x="0" y="0" width="110" height="32" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="0.8"/>
      <text x="55" y="20" text-anchor="middle" font-size="11" font-weight="600" fill="#38bdf8">3D CUTAWAY</text>

      <rect x="120" y="0" width="120" height="32" rx="4" fill="#1e293b" stroke="#475569" stroke-width="0.8"/>
      <text x="180" y="20" text-anchor="middle" font-size="10" font-weight="500" fill="#cbd5e1">ISO 30° VIEW</text>

      <rect x="250" y="0" width="130" height="32" rx="4" fill="#1e293b" stroke="#475569" stroke-width="0.8"/>
      <text x="315" y="20" text-anchor="middle" font-size="10" font-weight="500" fill="#94a3b8">DATE: ${dateStr}</text>
    </g>

    <!-- Compass Rose -->
    <g transform="translate(100, 100)">
      <circle cx="0" cy="0" r="24" fill="rgba(15, 23, 42, 0.85)" stroke="#38bdf8" stroke-width="1.2"/>
      <polygon points="0,-18 5,-2 0,2 -5,-2" fill="#38bdf8"/>
      <polygon points="0,18 5,2 0,-2 -5,2" fill="#475569"/>
      <polygon points="18,0 2,5 -2,0 2,-5" fill="#475569"/>
      <polygon points="-18,0 -2,5 2,0 -2,-5" fill="#475569"/>
      <text x="0" y="-22" text-anchor="middle" font-size="10" font-weight="800" fill="#38bdf8">N</text>
    </g>
  </g>
</svg>`);

  return svgParts.join('\n');
}

/**
 * Renders an extruded 3D wall with lighting and architectural cut cap.
 */
function render3DWall(
  svg: string[],
  camera: IsometricCamera,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  h: number,
  orientation: 'north' | 'west' | 'east' | 'south' | 'interior_x' | 'interior_y',
  windows?: RoomLayoutSpec['windows'],
  doors?: RoomLayoutSpec['doors']
) {
  const wallThickness = 7;
  // Calculate normal vector
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;

  const nx = (-dy / len) * wallThickness;
  const ny = (dx / len) * wallThickness;

  // 4 base coordinates
  const b1 = { x: x1, y: y1, z: 0 };
  const b2 = { x: x2, y: y2, z: 0 };
  const b3 = { x: x2 + nx, y: y2 + ny, z: 0 };
  const b4 = { x: x1 + nx, y: y1 + ny, z: 0 };

  // 4 top coordinates
  const t1 = { x: x1, y: y1, z: h };
  const t2 = { x: x2, y: y2, z: h };
  const t3 = { x: x2 + nx, y: y2 + ny, z: h };
  const t4 = { x: x1 + nx, y: y1 + ny, z: h };

  // Wall face styling based on orientation and daylight source (key light from NW)
  let faceFill = 'url(#wallLightRight)';
  let shadeFill = 'url(#wallLightLeft)';
  if (orientation === 'north' || orientation === 'interior_x') {
    faceFill = '#e2e8f0';
    shadeFill = '#94a3b8';
  } else if (orientation === 'west' || orientation === 'interior_y') {
    faceFill = '#f8fafc';
    shadeFill = '#cbd5e1';
  } else {
    faceFill = '#cbd5e1';
    shadeFill = '#64748b';
  }

  // Render Front Wall Face
  svg.push(`
    <g class="wall-segment">
      <polygon points="${camera.polyStr([b1, b2, t2, t1])}" fill="${faceFill}" stroke="#64748b" stroke-width="0.8"/>
      <!-- Wall Cut Cap (top surface) -->
      <polygon points="${camera.polyStr([t1, t2, t3, t4])}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
      <!-- Wall Side Return -->
      <polygon points="${camera.polyStr([b2, b3, t3, t2])}" fill="${shadeFill}" stroke="#64748b" stroke-width="0.8"/>
    </g>`);

  // Window cutouts on high back walls
  if (windows && windows.length > 0 && h > 60) {
    windows.forEach((w) => {
      const winW = (w.widthPercent / 100) * len;
      const winOff = (w.offsetPercent / 100) * len;
      const wx1 = x1 + (dx / len) * winOff;
      const wy1 = y1 + (dy / len) * winOff;
      const wx2 = wx1 + (dx / len) * winW;
      const wy2 = wy1 + (dy / len) * winW;

      const wb1 = { x: wx1, y: wy1, z: h * 0.35 };
      const wb2 = { x: wx2, y: wy2, z: h * 0.35 };
      const wt2 = { x: wx2, y: wy2, z: h * 0.85 };
      const wt1 = { x: wx1, y: wy1, z: h * 0.85 };

      svg.push(`
      <!-- Window Cutout & Glass -->
      <polygon points="${camera.polyStr([wb1, wb2, wt2, wt1])}" fill="url(#glassGradient)" stroke="#38bdf8" stroke-width="1.2"/>
      <!-- Window Sunlight Beam streaming onto floor -->
      <polygon points="${camera.polyStr([
        wb1, wb2,
        { x: wx2 + 80, y: wy2 + 80, z: 0 },
        { x: wx1 + 80, y: wy1 + 80, z: 0 }
      ])}" fill="url(#sunBeam)" opacity="0.45"/>`);
    });
  }

  // Door opening cutaways
  if (doors && doors.length > 0 && h > 40) {
    doors.forEach((d) => {
      const doorW = 34; // standard 34px door
      const dOff = Math.min(len - doorW - 5, (d.offsetPercent / 100) * len);
      const dx1 = x1 + (dx / len) * dOff;
      const dy1 = y1 + (dy / len) * dOff;
      const dx2 = dx1 + (dx / len) * doorW;
      const dy2 = dy1 + (dy / len) * doorW;

      const db1 = { x: dx1, y: dy1, z: 0 };
      const db2 = { x: dx2, y: dy2, z: 0 };
      const dt2 = { x: dx2, y: dy2, z: h * 0.75 };
      const dt1 = { x: dx1, y: dy1, z: h * 0.75 };

      svg.push(`
      <!-- Door Opening Gap -->
      <polygon points="${camera.polyStr([db1, db2, dt2, dt1])}" fill="#0f172a" stroke="#475569" stroke-width="1"/>`);
    });
  }
}

/**
 * Procedural 3D Furniture Builder
 * Renders authentic isometric 3D models for each room type.
 */
function render3DFurniture(svg: string[], camera: IsometricCamera, room: any) {
  const { cx, cy, rw, rh, type } = room;

  svg.push(`  <g class="furniture-group" filter="url(#furnitureShadow)">`);

  if (type === 'living') {
    // 1. 3D Sectional L-Sofa
    const sofaW = Math.min(rw * 0.55, 120);
    const sofaD = Math.min(rh * 0.45, 95);
    const sofaX = cx - sofaW / 2;
    const sofaY = cy - sofaD / 2;

    render3DBox(svg, camera, sofaX, sofaY, 0, sofaW, 30, 22, '#475569', '#334155'); // main base
    render3DBox(svg, camera, sofaX, sofaY, 22, sofaW, 10, 16, '#64748b', '#475569'); // backrest
    render3DBox(svg, camera, sofaX, sofaY + 30, 0, 30, sofaD - 30, 22, '#475569', '#334155'); // chaise return

    // 2. Coffee Table
    const tableX = cx + 8;
    const tableY = cy + 5;
    render3DBox(svg, camera, tableX, tableY, 0, 48, 28, 12, '#94a3b8', '#64748b');

    // 3. Media Credenza & TV
    const credX = room.rx + 15;
    const credY = room.y2 - 20;
    render3DBox(svg, camera, credX, credY, 0, Math.min(rw * 0.5, 90), 16, 18, '#1e293b', '#0f172a');
  } else if (type === 'bedroom') {
    // 1. 3D Queen/King Bed
    const bedW = Math.min(rw * 0.5, 85);
    const bedL = Math.min(rh * 0.6, 110);
    const bedX = cx - bedW / 2;
    const bedY = cy - bedL / 2;

    // Headboard
    render3DBox(svg, camera, bedX - 4, bedY - 4, 0, bedW + 8, 10, 38, '#334155', '#1e293b');
    // Mattress Base
    render3DBox(svg, camera, bedX, bedY + 6, 0, bedW, bedL - 6, 20, '#f8fafc', '#e2e8f0');
    // Duvet Fold
    render3DBox(svg, camera, bedX, bedY + 35, 20, bedW, bedL - 35, 3, '#38bdf8', '#0284c7');
    // Twin Pillows
    render3DBox(svg, camera, bedX + 4, bedY + 8, 20, bedW * 0.42, 16, 6, '#ffffff', '#cbd5e1');
    render3DBox(svg, camera, bedX + bedW * 0.52, bedY + 8, 20, bedW * 0.42, 16, 6, '#ffffff', '#cbd5e1');

    // 2. Twin Nightstands
    render3DBox(svg, camera, bedX - 22, bedY, 0, 18, 18, 18, '#475569', '#334155');
    render3DBox(svg, camera, bedX + bedW + 4, bedY, 0, 18, 18, 18, '#475569', '#334155');
  } else if (type === 'kitchen') {
    // 1. L-Shaped Granite Countertop
    const counterW = Math.min(rw * 0.7, 130);
    const counterD = Math.min(rh * 0.65, 110);
    render3DBox(svg, camera, room.rx + 10, room.ry + 10, 0, counterW, 26, 32, '#f1f5f9', '#94a3b8');
    render3DBox(svg, camera, room.rx + 10, room.ry + 36, 0, 26, counterD - 26, 32, '#f1f5f9', '#94a3b8');

    // 2. Kitchen Island
    if (rw > 140 && rh > 120) {
      render3DBox(svg, camera, cx + 5, cy, 0, 55, 32, 32, '#ffffff', '#64748b');
    }
  } else if (type === 'dining') {
    // 1. Dining Table & 4 Chairs
    const tableW = Math.min(rw * 0.48, 85);
    const tableD = Math.min(rh * 0.42, 55);
    const tX = cx - tableW / 2;
    const tY = cy - tableD / 2;

    render3DBox(svg, camera, tX, tY, 0, tableW, tableD, 26, '#c29b74', '#9e754f');
    // Chairs
    render3DBox(svg, camera, tX + 10, tY - 14, 0, 20, 12, 32, '#475569', '#334155');
    render3DBox(svg, camera, tX + tableW - 30, tY - 14, 0, 20, 12, 32, '#475569', '#334155');
    render3DBox(svg, camera, tX + 10, tY + tableD + 2, 0, 20, 12, 32, '#475569', '#334155');
    render3DBox(svg, camera, tX + tableW - 30, tY + tableD + 2, 0, 20, 12, 32, '#475569', '#334155');
  } else if (type === 'bath') {
    // 1. Vanity Unit & Mirror
    render3DBox(svg, camera, room.rx + 8, room.ry + 8, 0, 48, 22, 28, '#ffffff', '#cbd5e1');

    // 2. Glass Walk-In Shower Enclosure
    const showerX = room.x2 - 46;
    const showerY = room.ry + 8;
    render3DBox(svg, camera, showerX, showerY, 0, 38, 38, 4, '#1e293b', '#0f172a'); // shower tray
    // Glass panel
    const gp1 = camera.projectFlat(showerX, showerY, 0);
    const gp2 = camera.projectFlat(showerX, showerY + 38, 0);
    const gpt2 = camera.projectFlat(showerX, showerY + 38, 65);
    const gpt1 = camera.projectFlat(showerX, showerY, 65);
    svg.push(`
      <polygon points="${gp1.x},${gp1.y} ${gp2.x},${gp2.y} ${gpt2.x},${gpt2.y} ${gpt1.x},${gpt1.y}"
        fill="url(#glassGradient)" stroke="#38bdf8" stroke-width="1.2"/>`);

    // 3. Toilet Fixture
    render3DBox(svg, camera, room.rx + 8, room.y2 - 32, 0, 18, 24, 18, '#ffffff', '#e2e8f0');
  } else if (type === 'office') {
    // 1. Executive Desk & Chair
    const deskW = Math.min(rw * 0.5, 80);
    const deskD = 40;
    render3DBox(svg, camera, cx - deskW / 2, cy - 20, 0, deskW, deskD, 26, '#334155', '#1e293b');
    // Dual monitors
    render3DBox(svg, camera, cx - 18, cy - 14, 26, 36, 6, 18, '#0f172a', '#000000');
    // Office chair
    render3DBox(svg, camera, cx - 12, cy + 24, 0, 24, 20, 30, '#1e293b', '#0f172a');
  } else {
    // General Lounge / Accent furniture
    render3DBox(svg, camera, cx - 25, cy - 25, 0, 50, 50, 16, '#64748b', '#475569');
  }

  svg.push(`  </g>`);
}

/**
 * Helper to render an isometric 3D box (e.g. furniture, pedestals, counters).
 */
function render3DBox(
  svg: string[],
  camera: IsometricCamera,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  topFill: string,
  sideFill: string
) {
  const p1 = camera.projectFlat(x, y, z);
  const p2 = camera.projectFlat(x + w, y, z);
  const p3 = camera.projectFlat(x + w, y + d, z);
  const p4 = camera.projectFlat(x, y + d, z);

  const t1 = camera.projectFlat(x, y, z + h);
  const t2 = camera.projectFlat(x + w, y, z + h);
  const t3 = camera.projectFlat(x + w, y + d, z + h);
  const t4 = camera.projectFlat(x, y + d, z + h);

  svg.push(`
    <!-- 3D Box -->
    <polygon points="${t1.x.toFixed(1)},${t1.y.toFixed(1)} ${t2.x.toFixed(1)},${t2.y.toFixed(1)} ${t3.x.toFixed(1)},${t3.y.toFixed(1)} ${t4.x.toFixed(1)},${t4.y.toFixed(1)}"
      fill="${topFill}" stroke="rgba(255,255,255,0.2)" stroke-width="0.7"/>
    <polygon points="${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${t3.x.toFixed(1)},${t3.y.toFixed(1)} ${t2.x.toFixed(1)},${t2.y.toFixed(1)}"
      fill="${sideFill}" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/>
    <polygon points="${p3.x.toFixed(1)},${p3.y.toFixed(1)} ${p4.x.toFixed(1)},${p4.y.toFixed(1)} ${t4.x.toFixed(1)},${t4.y.toFixed(1)} ${t3.x.toFixed(1)},${t3.y.toFixed(1)}"
      fill="${sideFill}" stroke="rgba(0,0,0,0.3)" stroke-width="0.7"/>`);
}

/**
 * Generates an Architectural Colorized Presentation Floor Plan in SVG.
 * Designed for the FLOOR_PLAN_COLORIZE tool.
 */
export function generateColorizedFloorPlanSVG(
  rooms: RoomLayoutSpec[],
  options: VisualizationOptions = {}
): string {
  const width = 1600;
  const height = 1200;
  const title = options.title || 'Colorized Presentation Floor Plan';
  const subtitle = options.subtitle || 'Interior Architecture Presentation Render';
  const dateStr = new Date().toISOString().split('T')[0];

  const pad = 100;
  const drawW = width - pad * 2;
  const drawH = height - pad * 2 - 80;

  const pixelRooms = rooms.map((r) => {
    const rx = pad + (r.bounds.x / 100) * drawW;
    const ry = pad + (r.bounds.y / 100) * drawH;
    const rw = Math.max(90, (r.bounds.w / 100) * drawW);
    const rh = Math.max(90, (r.bounds.h / 100) * drawH);
    return {
      ...r,
      rx,
      ry,
      rw,
      rh,
      cx: rx + rw / 2,
      cy: ry + rh / 2,
    };
  });

  const svgParts: string[] = [];

  svgParts.push(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
  <defs>
    <!-- Hardwood Pattern -->
    <pattern id="planWoodPattern" width="40" height="20" patternUnits="userSpaceOnUse">
      <rect width="40" height="20" fill="#e7d3ba"/>
      <rect x="0" y="0" width="40" height="10" fill="#dfc7ab" stroke="#cbb092" stroke-width="0.6"/>
      <rect x="0" y="10" width="40" height="10" fill="#e7d3ba" stroke="#cbb092" stroke-width="0.6"/>
      <line x1="20" y1="0" x2="20" y2="10" stroke="#cbb092" stroke-width="0.6"/>
      <line x1="30" y1="10" x2="30" y2="20" stroke="#cbb092" stroke-width="0.6"/>
    </pattern>

    <!-- Porcelain Tile Pattern -->
    <pattern id="planTilePattern" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#cbd5e1"/>
      <rect width="28" height="28" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.8"/>
    </pattern>

    <!-- Wall Drop Shadow -->
    <filter id="wallShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="3" dy="5" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background Base Sheet -->
  <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" rx="6"/>

  <!-- Room Floors with Textures -->
  <g class="floor-finishes">
`);

  pixelRooms.forEach((r) => {
    let fill = 'url(#planWoodPattern)';
    if (r.type === 'kitchen' || r.type === 'bath') fill = 'url(#planTilePattern)';
    else if (r.type === 'balcony' || r.type === 'patio') fill = '#e2e8f0';

    svgParts.push(`
    <rect x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${r.rh}" fill="${fill}" stroke="#94a3b8" stroke-width="1"/>`);
  });

  svgParts.push(`  </g>`);

  // Walls with Solid Luxury Dark Fill & Drop Shadows
  svgParts.push(`  <!-- Walls with Luxury Dark Fill -->
  <g filter="url(#wallShadow)">`);
  pixelRooms.forEach((r) => {
    const wallThick = 9;
    svgParts.push(`
    <!-- Room Perimeter Walls -->
    <rect x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${wallThick}" fill="#1e293b"/>
    <rect x="${r.rx}" y="${r.ry + r.rh - wallThick}" width="${r.rw}" height="${wallThick}" fill="#1e293b"/>
    <rect x="${r.rx}" y="${r.ry}" width="${wallThick}" height="${r.rh}" fill="#1e293b"/>
    <rect x="${r.rx + r.rw - wallThick}" y="${r.ry}" width="${wallThick}" height="${r.rh}" fill="#1e293b"/>`);
  });
  svgParts.push(`  </g>`);

  // Room Presentation Labels
  svgParts.push(`  <!-- Presentation Room Labels -->`);
  pixelRooms.forEach((r) => {
    const labelW = Math.max(140, r.name.length * 9.5 + 24);
    svgParts.push(`
    <g transform="translate(${r.cx}, ${r.cy})">
      <rect x="${-labelW / 2}" y="-20" width="${labelW}" height="40" rx="20" fill="rgba(255,255,255,0.92)" stroke="#0284c7" stroke-width="1.2"/>
      <text x="0" y="-3" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${escapeXml(r.name.toUpperCase())}</text>
      <text x="0" y="12" text-anchor="middle" font-size="10" font-weight="500" fill="#64748b">${escapeXml(r.dimensions)}</text>
    </g>`);
  });

  // Presentation Title Card
  svgParts.push(`
  <!-- Title Card -->
  <g transform="translate(60, ${height - 90})">
    <rect x="0" y="0" width="${width - 120}" height="60" rx="4" fill="#0f172a"/>
    <text x="30" y="32" font-size="17" font-weight="700" fill="#ffffff" letter-spacing="0.5">${escapeXml(title.toUpperCase())}</text>
    <text x="30" y="49" font-size="11" font-weight="400" fill="#94a3b8">${escapeXml(subtitle)} • DATE: ${dateStr}</text>
    <text x="${width - 160}" y="36" text-anchor="end" font-size="12" font-weight="600" fill="#38bdf8">BUILDSMART PRESENTATION CAD</text>
  </g>
</svg>`);

  return svgParts.join('\n');
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
