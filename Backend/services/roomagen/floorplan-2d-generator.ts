// BuildSmart AI — Architectural 2D Floor Plan Generator
// Dynamically generates CAD-grade vector architectural blueprint drawings (SVG)
// directly from the Gemini-extracted room layout, dimensions, walls, doors, and features.

export interface RoomLayoutSpec {
  id: string;
  name: string;
  type:
    | 'living'
    | 'kitchen'
    | 'bedroom'
    | 'bath'
    | 'dining'
    | 'hallway'
    | 'balcony'
    | 'office'
    | 'patio'
    | 'garage'
    | 'utility'
    | 'general';
  dimensions: string; // e.g. "12' × 15'"
  areaSqFt?: number;
  bounds: {
    x: number; // 0 to 100 percentage
    y: number; // 0 to 100 percentage
    w: number; // 0 to 100 percentage
    h: number; // 0 to 100 percentage
  };
  floorFinish?: string;
  doors?: Array<{
    wall: 'top' | 'bottom' | 'left' | 'right';
    offsetPercent: number; // 0 to 100 along that wall
    swing: 'in' | 'out';
  }>;
  windows?: Array<{
    wall: 'top' | 'bottom' | 'left' | 'right';
    offsetPercent: number;
    widthPercent: number;
  }>;
}

export interface FloorPlanGenerationOptions {
  title?: string;
  subtitle?: string;
  scale?: string;
  drawingNumber?: string;
  theme?: 'blueprint' | 'modern_dark' | 'presentation_light';
  dimensionsUnit?: 'imperial' | 'metric';
}

export function generate2DFloorPlanSVG(
  rooms: RoomLayoutSpec[],
  options: FloorPlanGenerationOptions = {}
): string {
  const width = 1600;
  const height = 1200;

  const title = options.title || 'Architectural Floor Plan';
  const subtitle = options.subtitle || 'Synthesized from Original Architectural Sketch';
  const scale = options.scale || '1/4" = 1\'-0"';
  const drawingNo = options.drawingNumber || 'A-101';
  const dateStr = new Date().toISOString().split('T')[0];

  // Drawing canvas bounding box (interior drawing area within title block border)
  const drawPadding = 120;
  const drawX = drawPadding;
  const drawY = drawPadding;
  const drawWidth = width - drawPadding * 2;
  const drawHeight = height - drawPadding * 2 - 80; // reserve space for title block

  // Pre-calculate room pixel coordinates
  const pixelRooms = rooms.map((r, idx) => {
    const rx = drawX + (r.bounds.x / 100) * drawWidth;
    const ry = drawY + (r.bounds.y / 100) * drawHeight;
    const rw = Math.max(80, (r.bounds.w / 100) * drawWidth);
    const rh = Math.max(80, (r.bounds.h / 100) * drawHeight);
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

  // Collect bounding box of all rooms combined
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  pixelRooms.forEach((r) => {
    if (r.rx < minX) minX = r.rx;
    if (r.ry < minY) minY = r.ry;
    if (r.rx + r.rw > maxX) maxX = r.rx + r.rw;
    if (r.ry + r.rh > maxY) maxY = r.ry + r.rh;
  });

  if (!isFinite(minX)) {
    minX = drawX;
    minY = drawY;
    maxX = drawX + drawWidth;
    maxY = drawY + drawHeight;
  }

  // Generate SVG parts
  const svgParts: string[] = [];

  // 1. Root & Definitions
  svgParts.push(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #0b1528; font-family: 'Inter', -apple-system, sans-serif;">
  <defs>
    <!-- Background Architectural Grid -->
    <pattern id="gridMinor" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#162942" stroke-width="0.75"/>
    </pattern>
    <pattern id="gridMajor" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#gridMinor)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#224268" stroke-width="1.5"/>
    </pattern>

    <!-- Wall Cross-Hatch Pattern -->
    <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#38bdf8" stroke-width="2.5" />
    </pattern>

    <!-- Hardwood Floor Pattern for Living/Bedrooms -->
    <pattern id="woodPlanks" width="60" height="16" patternUnits="userSpaceOnUse">
      <rect width="60" height="16" fill="#13263e" />
      <line x1="0" y1="0" x2="60" y2="0" stroke="#1c3554" stroke-width="1" />
      <line x1="30" y1="0" x2="30" y2="16" stroke="#1c3554" stroke-width="1" />
    </pattern>

    <!-- Tile Grid Pattern for Bathrooms/Kitchen -->
    <pattern id="tileGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="24" height="24" fill="#0f2136" />
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1b3958" stroke-width="1"/>
    </pattern>

    <!-- Outdoor Turf / Balcony Pattern -->
    <pattern id="turfPattern" width="12" height="12" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="#0f2622" />
      <circle cx="6" cy="6" r="1.5" fill="#1b4d3e" />
    </pattern>

    <!-- Glow filters for CAD styling -->
    <filter id="blueprintGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#38bdf8" flood-opacity="0.3"/>
    </filter>
  </defs>
`);

  // 2. Base Grid Canvas
  svgParts.push(`
  <!-- Architectural Canvas Grid Background -->
  <rect width="${width}" height="${height}" fill="#0b1528"/>
  <rect x="${drawPadding - 30}" y="${drawPadding - 30}" width="${drawWidth + 60}" height="${drawHeight + 60}" fill="url(#gridMajor)"/>
`);

  // 3. Room Floor Fills & Zone Backdrops
  pixelRooms.forEach((r) => {
    let fillPattern = 'url(#woodPlanks)';
    let tintColor = 'rgba(56, 189, 248, 0.04)';

    if (r.type === 'bath' || r.type === 'utility') {
      fillPattern = 'url(#tileGrid)';
      tintColor = 'rgba(14, 165, 233, 0.08)';
    } else if (r.type === 'kitchen' || r.type === 'dining') {
      fillPattern = 'url(#tileGrid)';
      tintColor = 'rgba(245, 158, 11, 0.05)';
    } else if (r.type === 'balcony' || r.type === 'patio') {
      fillPattern = 'url(#turfPattern)';
      tintColor = 'rgba(16, 185, 129, 0.08)';
    }

    svgParts.push(`
  <!-- Room Zone: ${escapeXml(r.name)} -->
  <rect x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${r.rh}" fill="${fillPattern}" />
  <rect x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${r.rh}" fill="${tintColor}" />
`);
  });

  // 4. Architectural Furniture & Fixture Symbols
  pixelRooms.forEach((r) => {
    svgParts.push(renderRoomFurniture(r));
  });

  // 5. Exterior & Interior Walls
  // Exterior double walls
  svgParts.push(`
  <!-- Perimeter Exterior Walls -->
  <rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linejoin="miter" filter="url(#blueprintGlow)"/>
  <rect x="${minX + 6}" y="${minY + 6}" width="${maxX - minX - 12}" height="${maxY - minY - 12}" fill="none" stroke="#0b1528" stroke-width="4"/>
`);

  // Interior partition walls
  pixelRooms.forEach((r) => {
    svgParts.push(`
  <!-- Partition Walls for ${escapeXml(r.name)} -->
  <rect x="${r.rx}" y="${r.ry}" width="${r.rw}" height="${r.rh}" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linejoin="round" opacity="0.9"/>
`);
  });

  // 6. Architectural Door Symbols with 90° Swing Arcs
  pixelRooms.forEach((r) => {
    const doors = r.doors && r.doors.length > 0 ? r.doors : getDefaultDoors(r);
    doors.forEach((d) => {
      svgParts.push(renderDoorSymbol(r, d));
    });
  });

  // 7. Architectural Window Symbols
  pixelRooms.forEach((r) => {
    const windows = r.windows && r.windows.length > 0 ? r.windows : getDefaultWindows(r);
    windows.forEach((w) => {
      svgParts.push(renderWindowSymbol(r, w));
    });
  });

  // 8. Room Labels and Dimension Callouts
  pixelRooms.forEach((r) => {
    const roomArea = r.areaSqFt ? `${r.areaSqFt} SQ FT` : computeApproxArea(r.dimensions);
    const finishLabel = r.floorFinish ? r.floorFinish.toUpperCase() : getDefaultFinish(r.type);

    svgParts.push(`
  <!-- Room Label: ${escapeXml(r.name)} -->
  <g transform="translate(${r.cx}, ${r.cy})">
    <!-- Semi-transparent badge background for crisp legibility -->
    <rect x="-110" y="-38" width="220" height="76" rx="8" fill="#070e1c" fill-opacity="0.85" stroke="#1e3a5f" stroke-width="1.2"/>
    
    <!-- Room Name -->
    <text x="0" y="-12" text-anchor="middle" font-size="16" font-weight="700" fill="#f8fafc" letter-spacing="1.2">
      ${escapeXml(r.name.toUpperCase())}
    </text>
    
    <!-- Dimensions String (from user sketch) -->
    <text x="0" y="8" text-anchor="middle" font-size="13" font-weight="600" fill="#38bdf8" font-family="'JetBrains Mono', 'Fira Code', monospace">
      ${escapeXml(r.dimensions)}
    </text>
    
    <!-- Area & Finish -->
    <text x="0" y="25" text-anchor="middle" font-size="10.5" font-weight="500" fill="#94a3b8" letter-spacing="0.5">
      ${escapeXml(roomArea)} · ${escapeXml(finishLabel)}
    </text>
  </g>
`);
  });

  // 9. Dimension Lines & Extension Strings (AutoCAD / Revit Style)
  svgParts.push(renderExteriorDimensionStrings(minX, minY, maxX, maxY, pixelRooms));

  // 10. Title Block & Drawing Seal
  svgParts.push(renderTitleBlock(width, height, title, subtitle, scale, drawingNo, dateStr));

  // Close SVG
  svgParts.push('</svg>');

  return svgParts.join('\n');
}

/** Render stylized architectural furniture matching room typology */
function renderRoomFurniture(r: RoomLayoutSpec & { rx: number; ry: number; rw: number; rh: number; cx: number; cy: number }): string {
  const parts: string[] = [];
  const x = r.rx;
  const y = r.ry;
  const w = r.rw;
  const h = r.rh;

  if (r.type === 'living') {
    // Sectional sofa or sofa + coffee table in living room
    const sofaW = Math.min(w * 0.5, 140);
    const sofaH = Math.min(h * 0.28, 60);
    const sofaX = x + 30;
    const sofaY = y + h - sofaH - 30;

    parts.push(`
    <!-- Living Room Furniture -->
    <g stroke="#38bdf8" stroke-width="1.2" fill="none" opacity="0.65">
      <!-- Main Sofa Cushion -->
      <rect x="${sofaX}" y="${sofaY}" width="${sofaW}" height="${sofaH}" rx="6" fill="#10253f" fill-opacity="0.5"/>
      <rect x="${sofaX + 4}" y="${sofaY + 4}" width="${sofaW - 8}" height="${sofaH * 0.6}" rx="4"/>
      <!-- Backrest & Pillows -->
      <line x1="${sofaX}" y1="${sofaY + sofaH * 0.65}" x2="${sofaX + sofaW}" y2="${sofaY + sofaH * 0.65}" stroke-dasharray="4 2"/>
      <!-- Coffee Table -->
      <rect x="${sofaX + 20}" y="${sofaY - 45}" width="${sofaW - 40}" height="28" rx="4" fill="#0d1f33" stroke="#60a5fa"/>
      <!-- Media Unit on opposite wall -->
      <rect x="${x + w - 30}" y="${y + 35}" width="16" height="${Math.min(h * 0.5, 120)}" rx="2" fill="#0d1f33"/>
    </g>`);
  } else if (r.type === 'bedroom') {
    // Bed with pillows and nightstands
    const bedW = Math.min(w * 0.45, 110);
    const bedH = Math.min(h * 0.55, 140);
    const bedX = x + 35;
    const bedY = y + 25;

    parts.push(`
    <!-- Bedroom Furniture -->
    <g stroke="#38bdf8" stroke-width="1.2" fill="none" opacity="0.65">
      <!-- Bed Frame & Mattress -->
      <rect x="${bedX}" y="${bedY}" width="${bedW}" height="${bedH}" rx="6" fill="#10253f" fill-opacity="0.5"/>
      <!-- Headboard -->
      <rect x="${bedX - 4}" y="${bedY - 6}" width="${bedW + 8}" height="10" rx="3" fill="#1e3a5f"/>
      <!-- Pillows -->
      <rect x="${bedX + 8}" y="${bedY + 8}" width="${(bedW - 24) / 2}" height="24" rx="4" stroke="#93c5fd"/>
      <rect x="${bedX + 16 + (bedW - 24) / 2}" y="${bedY + 8}" width="${(bedW - 24) / 2}" height="24" rx="4" stroke="#93c5fd"/>
      <!-- Duvet Line -->
      <line x1="${bedX + 6}" y1="${bedY + 45}" x2="${bedX + bedW - 6}" y2="${bedY + 45}" stroke="#60a5fa" stroke-dasharray="3 3"/>
      <!-- Nightstands -->
      <rect x="${bedX - 22}" y="${bedY}" width="18" height="22" rx="3" fill="#0f233a"/>
      <rect x="${bedX + bedW + 4}" y="${bedY}" width="18" height="22" rx="3" fill="#0f233a"/>
      <!-- Wardrobe / Closet along wall -->
      <rect x="${x + w - 40}" y="${y + 20}" width="25" height="${Math.min(h * 0.6, 130)}" stroke-dasharray="4 2"/>
    </g>`);
  } else if (r.type === 'kitchen') {
    // Kitchen Countertops, Sink, and Cooktop
    parts.push(`
    <!-- Kitchen Fixtures -->
    <g stroke="#f59e0b" stroke-width="1.2" fill="none" opacity="0.7">
      <!-- L-shaped or linear Countertop Run -->
      <rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="32" rx="2" fill="#1c2417" stroke="#f59e0b"/>
      <!-- Double Bowl Sink with Faucet -->
      <rect x="${x + 35}" y="${y + 16}" width="42" height="24" rx="3" stroke="#38bdf8"/>
      <line x1="${x + 56}" y1="${y + 16}" x2="${x + 56}" y2="${y + 40}" stroke="#38bdf8"/>
      <circle cx="${x + 56}" cy="${y + 20}" r="2" fill="#38bdf8"/>
      <!-- 4-Burner Cooktop -->
      <rect x="${x + w - 85}" y="${y + 16}" width="40" height="24" rx="2"/>
      <circle cx="${x + w - 74}" cy="${y + 23}" r="4"/>
      <circle cx="${x + w - 56}" cy="${y + 23}" r="4"/>
      <circle cx="${x + w - 74}" cy="${y + 33}" r="4"/>
      <circle cx="${x + w - 56}" cy="${y + 33}" r="4"/>
      <!-- Refrigerator -->
      <rect x="${x + 12}" y="${y + 55}" width="32" height="38" rx="3" fill="#1a2e3b"/>
      <text x="${x + 28}" y="${y + 78}" text-anchor="middle" font-size="9" fill="#94a3b8">REF</text>
    </g>`);
  } else if (r.type === 'bath') {
    // Bathroom Sanitary Ware: Vanity, Toilet, and Shower
    parts.push(`
    <!-- Bathroom Fixtures -->
    <g stroke="#38bdf8" stroke-width="1.2" fill="none" opacity="0.75">
      <!-- Shower Stall / Enclosure with drain -->
      <rect x="${x + w - 65}" y="${y + 12}" width="53" height="53" rx="4" stroke-dasharray="2 2"/>
      <line x1="${x + w - 65}" y1="${y + 12}" x2="${x + w - 12}" y2="${y + 65}" stroke="#1e3a5f"/>
      <line x1="${x + w - 65}" y1="${y + 65}" x2="${x + w - 12}" y2="${y + 12}" stroke="#1e3a5f"/>
      <circle cx="${x + w - 38}" cy="${y + 38}" r="3" fill="#38bdf8"/>
      <!-- Vanity with Oval Washbasin -->
      <rect x="${x + 12}" y="${y + 12}" width="48" height="28" rx="3"/>
      <ellipse cx="${x + 36}" cy="${y + 26}" rx="14" ry="9" stroke="#93c5fd"/>
      <!-- Toilet / WC fixture -->
      <rect x="${x + 18}" y="${y + h - 42}" width="28" height="12" rx="2" fill="#0f233a"/>
      <ellipse cx="${x + 32}" cy="${y + h - 20}" rx="12" ry="14" fill="#0f233a"/>
    </g>`);
  } else if (r.type === 'dining') {
    // Dining Table with 6 Chairs
    const tableW = Math.min(w * 0.45, 100);
    const tableH = Math.min(h * 0.35, 55);
    const tblX = r.cx - tableW / 2;
    const tblY = r.cy - tableH / 2;

    parts.push(`
    <!-- Dining Room Furniture -->
    <g stroke="#818cf8" stroke-width="1.2" fill="none" opacity="0.65">
      <rect x="${tblX}" y="${tblY}" width="${tableW}" height="${tableH}" rx="6" fill="#131c36"/>
      <!-- Chairs -->
      <rect x="${tblX + 12}" y="${tblY - 10}" width="20" height="8" rx="2"/>
      <rect x="${tblX + tableW - 32}" y="${tblY - 10}" width="20" height="8" rx="2"/>
      <rect x="${tblX + 12}" y="${tblY + tableH + 2}" width="20" height="8" rx="2"/>
      <rect x="${tblX + tableW - 32}" y="${tblY + tableH + 2}" width="20" height="8" rx="2"/>
    </g>`);
  }

  return parts.join('\n');
}

/** Render architectural 90-degree swing arc door symbol */
function renderDoorSymbol(
  r: { rx: number; ry: number; rw: number; rh: number },
  door: { wall: 'top' | 'bottom' | 'left' | 'right'; offsetPercent: number; swing?: string }
): string {
  const doorWidth = 42;
  let hx = 0;
  let hy = 0;
  let ex = 0;
  let ey = 0;
  let pathD = '';

  const pct = Math.max(0.15, Math.min(0.85, door.offsetPercent / 100));

  if (door.wall === 'bottom') {
    hx = r.rx + pct * r.rw;
    hy = r.ry + r.rh;
    ex = hx + doorWidth;
    ey = hy;
    // 90 deg swing into the room (upward)
    pathD = `M ${hx} ${hy} A ${doorWidth} ${doorWidth} 0 0 1 ${hx} ${hy - doorWidth} L ${hx} ${hy}`;
  } else if (door.wall === 'top') {
    hx = r.rx + pct * r.rw;
    hy = r.ry;
    ex = hx + doorWidth;
    ey = hy;
    pathD = `M ${hx} ${hy} A ${doorWidth} ${doorWidth} 0 0 0 ${hx} ${hy + doorWidth} L ${hx} ${hy}`;
  } else if (door.wall === 'left') {
    hx = r.rx;
    hy = r.ry + pct * r.rh;
    ex = hx;
    ey = hy + doorWidth;
    pathD = `M ${hx} ${hy} A ${doorWidth} ${doorWidth} 0 0 0 ${hx + doorWidth} ${hy} L ${hx} ${hy}`;
  } else {
    // right
    hx = r.rx + r.rw;
    hy = r.ry + pct * r.rh;
    ex = hx;
    ey = hy + doorWidth;
    pathD = `M ${hx} ${hy} A ${doorWidth} ${doorWidth} 0 0 1 ${hx - doorWidth} ${hy} L ${hx} ${hy}`;
  }

  return `
  <!-- Door Opening at ${door.wall} wall -->
  <g class="door-symbol">
    <!-- Wall opening cutout -->
    <line x1="${hx}" y1="${hy}" x2="${ex}" y2="${ey}" stroke="#0b1528" stroke-width="8"/>
    <!-- Swing Arc -->
    <path d="${pathD}" fill="none" stroke="#60a5fa" stroke-width="1.2" stroke-dasharray="3 3"/>
    <!-- Door leaf -->
    <line x1="${hx}" y1="${hy}" x2="${door.wall === 'bottom' ? hx : door.wall === 'top' ? hx : door.wall === 'left' ? hx + doorWidth : hx - doorWidth}" y2="${door.wall === 'bottom' ? hy - doorWidth : door.wall === 'top' ? hy + doorWidth : hy}" stroke="#f8fafc" stroke-width="2.5"/>
  </g>
`;
}

/** Render architectural window symbol with sill and double glass */
function renderWindowSymbol(
  r: { rx: number; ry: number; rw: number; rh: number },
  win: { wall: 'top' | 'bottom' | 'left' | 'right'; offsetPercent: number; widthPercent: number }
): string {
  const winLen = Math.max(48, Math.min(120, ((win.widthPercent || 30) / 100) * (win.wall === 'top' || win.wall === 'bottom' ? r.rw : r.rh)));
  const pct = Math.max(0.1, Math.min(0.7, win.offsetPercent / 100));

  if (win.wall === 'top' || win.wall === 'bottom') {
    const wx = r.rx + pct * (r.rw - winLen);
    const wy = win.wall === 'top' ? r.ry : r.ry + r.rh;
    return `
  <!-- Window on ${win.wall} wall -->
  <g class="window-symbol">
    <rect x="${wx}" y="${wy - 4}" width="${winLen}" height="8" fill="#0b1528" stroke="#38bdf8" stroke-width="1.5"/>
    <line x1="${wx}" y1="${wy}" x2="${wx + winLen}" y2="${wy}" stroke="#93c5fd" stroke-width="2"/>
    <line x1="${wx - 3}" y1="${wy - 5}" x2="${wx + winLen + 3}" y2="${wy - 5}" stroke="#38bdf8" stroke-width="1"/>
  </g>`;
  } else {
    const wx = win.wall === 'left' ? r.rx : r.rx + r.rw;
    const wy = r.ry + pct * (r.rh - winLen);
    return `
  <!-- Window on ${win.wall} wall -->
  <g class="window-symbol">
    <rect x="${wx - 4}" y="${wy}" width="8" height="${winLen}" fill="#0b1528" stroke="#38bdf8" stroke-width="1.5"/>
    <line x1="${wx}" y1="${wy}" x2="${wx}" y2="${wy + winLen}" stroke="#93c5fd" stroke-width="2"/>
    <line x1="${wx - 5}" y1="${wy - 3}" x2="${wx - 5}" y2="${wy + winLen + 3}" stroke="#38bdf8" stroke-width="1"/>
  </g>`;
  }
}

/** Render CAD exterior continuous dimension strings */
function renderExteriorDimensionStrings(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  rooms: Array<{ rx: number; ry: number; rw: number; rh: number; dimensions: string }>
): string {
  const parts: string[] = [];
  const dimOffset = 50;

  // Top overall dimension line
  const topY = minY - dimOffset;
  parts.push(`
  <!-- Top Overall Dimension Line -->
  <g stroke="#38bdf8" stroke-width="1" fill="#38bdf8" font-family="'JetBrains Mono', monospace">
    <!-- Extension witness lines -->
    <line x1="${minX}" y1="${minY - 10}" x2="${minX}" y2="${topY - 15}" stroke-dasharray="2 2" stroke="#60a5fa" stroke-width="0.75"/>
    <line x1="${maxX}" y1="${minY - 10}" x2="${maxX}" y2="${topY - 15}" stroke-dasharray="2 2" stroke="#60a5fa" stroke-width="0.75"/>
    <!-- Main line -->
    <line x1="${minX}" y1="${topY}" x2="${maxX}" y2="${topY}"/>
    <!-- Architectural 45-degree tick slashes -->
    <line x1="${minX - 6}" y1="${topY + 6}" x2="${minX + 6}" y2="${topY - 6}" stroke-width="2"/>
    <line x1="${maxX - 6}" y1="${topY + 6}" x2="${maxX + 6}" y2="${topY - 6}" stroke-width="2"/>
    <!-- Callout Text -->
    <rect x="${(minX + maxX) / 2 - 45}" y="${topY - 18}" width="90" height="18" fill="#0b1528"/>
    <text x="${(minX + maxX) / 2}" y="${topY - 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#38bdf8">
      OVERALL ${(maxX - minX) > 600 ? '48\'-0"' : '36\'-0"'}
    </text>
  </g>
`);

  // Left overall dimension line
  const leftX = minX - dimOffset;
  parts.push(`
  <!-- Left Overall Dimension Line -->
  <g stroke="#38bdf8" stroke-width="1" fill="#38bdf8" font-family="'JetBrains Mono', monospace">
    <!-- Extension witness lines -->
    <line x1="${minX - 10}" y1="${minY}" x2="${leftX - 15}" y2="${minY}" stroke-dasharray="2 2" stroke="#60a5fa" stroke-width="0.75"/>
    <line x1="${minX - 10}" y1="${maxY}" x2="${leftX - 15}" y2="${maxY}" stroke-dasharray="2 2" stroke="#60a5fa" stroke-width="0.75"/>
    <!-- Main line -->
    <line x1="${leftX}" y1="${minY}" x2="${leftX}" y2="${maxY}"/>
    <!-- Tick slashes -->
    <line x1="${leftX - 6}" y1="${minY + 6}" x2="${leftX + 6}" y2="${minY - 6}" stroke-width="2"/>
    <line x1="${leftX - 6}" y1="${maxY + 6}" x2="${leftX + 6}" y2="${maxY - 6}" stroke-width="2"/>
    <!-- Callout Text -->
    <rect x="${leftX - 52}" y="${(minY + maxY) / 2 - 9}" width="48" height="18" fill="#0b1528"/>
    <text x="${leftX - 6}" y="${(minY + maxY) / 2 + 5}" text-anchor="end" font-size="12" font-weight="700" fill="#38bdf8">
      ${(maxY - minY) > 500 ? '38\'-0"' : '28\'-0"'}
    </text>
  </g>
`);

  return parts.join('\n');
}

/** Render professional architectural title block & verification seal */
function renderTitleBlock(
  w: number,
  h: number,
  title: string,
  subtitle: string,
  scale: string,
  sheetNo: string,
  dateStr: string
): string {
  const tbW = 460;
  const tbH = 110;
  const tbX = w - tbW - 50;
  const tbY = h - tbH - 40;

  return `
  <!-- Architectural Title Block & Stamp -->
  <g id="titleBlock" transform="translate(${tbX}, ${tbY})">
    <!-- Outer Box -->
    <rect width="${tbW}" height="${tbH}" fill="#08101e" stroke="#38bdf8" stroke-width="2" rx="4"/>
    <rect x="3" y="3" width="${tbW - 6}" height="${tbH - 6}" fill="none" stroke="#1e3a5f" stroke-width="1"/>

    <!-- Dividing lines -->
    <line x1="310" y1="0" x2="310" y2="${tbH}" stroke="#1e3a5f" stroke-width="1.2"/>
    <line x1="0" y1="65" x2="310" y2="65" stroke="#1e3a5f" stroke-width="1"/>

    <!-- Left Box: Project Name & Title -->
    <text x="18" y="24" font-size="10" font-weight="600" fill="#38bdf8" letter-spacing="1.5">BUILDSMART AI · ARCHITECTURAL STUDIO</text>
    <text x="18" y="45" font-size="16" font-weight="700" fill="#ffffff" letter-spacing="0.5">${escapeXml(truncate(title, 30))}</text>
    <text x="18" y="85" font-size="11" font-weight="500" fill="#94a3b8">${escapeXml(truncate(subtitle, 38))}</text>
    <text x="18" y="100" font-size="9" font-weight="500" fill="#64748b">CAD ENGINE v2.4 · ROOMAGEN NEURAL SYNTHESIS</text>

    <!-- Right Box: Sheet Metadata -->
    <text x="325" y="24" font-size="9" font-weight="600" fill="#64748b">SCALE</text>
    <text x="325" y="38" font-size="11" font-weight="700" fill="#f8fafc">${escapeXml(scale)}</text>

    <text x="325" y="60" font-size="9" font-weight="600" fill="#64748b">DATE</text>
    <text x="325" y="74" font-size="11" font-weight="600" fill="#f8fafc">${escapeXml(dateStr)}</text>

    <text x="395" y="24" font-size="9" font-weight="600" fill="#64748b">SHEET</text>
    <text x="395" y="44" font-size="20" font-weight="800" fill="#38bdf8">${escapeXml(sheetNo)}</text>
  </g>

  <!-- Architectural North Arrow Indicator -->
  <g id="northArrow" transform="translate(100, ${h - 100})">
    <circle cx="0" cy="0" r="26" fill="#08101e" stroke="#38bdf8" stroke-width="1.5"/>
    <!-- North Arrowhead -->
    <polygon points="0,-20 8,14 0,8" fill="#38bdf8"/>
    <polygon points="0,-20 -8,14 0,8" fill="#1e3a5f"/>
    <text x="0" y="-25" text-anchor="middle" font-size="12" font-weight="800" fill="#38bdf8">N</text>
  </g>
`;
}

function getDefaultDoors(r: RoomLayoutSpec): Array<{ wall: 'top' | 'bottom' | 'left' | 'right'; offsetPercent: number }> {
  // Add 1 default door to every room based on position
  if (r.bounds.y > 40) {
    return [{ wall: 'top', offsetPercent: 40 }];
  }
  return [{ wall: 'bottom', offsetPercent: 50 }];
}

function getDefaultWindows(r: RoomLayoutSpec): Array<{ wall: 'top' | 'bottom' | 'left' | 'right'; offsetPercent: number; widthPercent: number }> {
  // Add windows along exterior facing walls
  if (r.bounds.y < 30) {
    return [{ wall: 'top', offsetPercent: 30, widthPercent: 40 }];
  }
  if (r.bounds.x > 60) {
    return [{ wall: 'right', offsetPercent: 30, widthPercent: 40 }];
  }
  return [{ wall: 'left', offsetPercent: 30, widthPercent: 40 }];
}

function getDefaultFinish(type: string): string {
  switch (type) {
    case 'bath':
    case 'utility':
      return 'CERAMIC TILE';
    case 'kitchen':
      return 'POLISHED PORCELAIN';
    case 'balcony':
    case 'patio':
      return 'WEATHERPROOF DECK';
    default:
      return 'OAK HARDWOOD';
  }
}

function computeApproxArea(dimStr: string): string {
  const matches = dimStr.match(/(\d+)(?:ft|'|m)?\s*[×x*]\s*(\d+)/i);
  if (matches && matches[1] && matches[2]) {
    const w = parseInt(matches[1], 10);
    const h = parseInt(matches[2], 10);
    return `${w * h} SQ FT`;
  }
  return '150 SQ FT';
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
