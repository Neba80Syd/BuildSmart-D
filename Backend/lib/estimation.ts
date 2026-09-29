// BuildSmart AI — material estimation engine (Module 09 / 10).
// Produces preliminary, clearly-labelled construction-material quantities from
// project brief fields using documented rules of thumb. Quantities are ESTIMATES
// that require professional validation before procurement — never structural
// approval. All values are computed server-side so they cannot be tampered with.

export type EstimateItem = {
  category: string;
  material: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source: string;
  notes: string;
  linkedProductId: string | null;
};

export const ESTIMATE_CATEGORIES = ['Structural', 'Roofing', 'Finishing', 'Openings', 'Plumbing', 'Electrical'] as const;

export const ASSUMPTION_NOTE =
  'Preliminary estimate from project brief (rules of thumb). Validate with a structural engineer before procurement.';

// Local market reference prices (XAF) used when no marketplace listing is linked.
const PRICE = {
  cement: 4500, block: 450, sand: 15000, gravel: 22000, rebar: 6800,
  roofing: 5200, timber: 9500, tiles: 8500, paint: 32000, ceiling: 12000,
  door: 85000, window: 60000, frame: 15000, glass: 38000,
  pipe: 7800, fittings: 12000, sanitary: 95000,
  cable: 42000, switchgear: 2800, socket: 3500, light: 18000,
};

export function generateMaterialEstimate(project: any): EstimateItem[] {
  const siteArea = project?.siteArea ?? 200; // m² footprint
  const floors = Math.max(project?.floors ?? 1, 1);
  const rooms = Math.max(project?.rooms ?? 6, 2);
  const builtArea = siteArea * floors; // total floor area m²
  const roofArea = siteArea * 1.15;

  const q = (n: number, dp = 0) => Number(n.toFixed(dp));

  return [
    {
      category: 'Structural', material: 'Portland Cement 50kg', description: 'CEM II/B-L 42.5R — foundations & slabs',
      unit: 'bag', quantity: q(builtArea * 0.45), unitPrice: PRICE.cement, total: q(builtArea * 0.45 * PRICE.cement),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.45 bags/m² built area.`, linkedProductId: 'prod_1',
    },
    {
      category: 'Structural', material: 'Hollow Concrete Block 15cm', description: 'Load-bearing wall units',
      unit: 'block', quantity: q(builtArea * 12), unitPrice: PRICE.block, total: q(builtArea * 12 * PRICE.block),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 12 blocks/m² wall.`, linkedProductId: null,
    },
    {
      category: 'Structural', material: 'River Sand', description: 'Sharp sand for mortar & concrete',
      unit: 'm3', quantity: q(builtArea * 0.06, 1), unitPrice: PRICE.sand, total: q(builtArea * 0.06 * PRICE.sand),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.06 m³/m².`, linkedProductId: null,
    },
    {
      category: 'Structural', material: 'Gravel 20mm', description: 'Crushed aggregate for concrete',
      unit: 'm3', quantity: q(builtArea * 0.05, 1), unitPrice: PRICE.gravel, total: q(builtArea * 0.05 * PRICE.gravel),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.05 m³/m².`, linkedProductId: null,
    },
    {
      category: 'Structural', material: 'Steel Rebar 12mm', description: 'High-tensile deformed bar, 12m',
      unit: 'length', quantity: q(builtArea * 0.3), unitPrice: PRICE.rebar, total: q(builtArea * 0.3 * PRICE.rebar),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.3 lengths/m².`, linkedProductId: 'prod_2',
    },
    {
      category: 'Roofing', material: 'Galvanised Roofing Sheet', description: '0.5mm corrugated GI, 2.5m',
      unit: 'sheet', quantity: q(roofArea / 2.75), unitPrice: PRICE.roofing, total: q((roofArea / 2.75) * PRICE.roofing),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} roof area ×1.15 footprint.`, linkedProductId: 'prod_6',
    },
    {
      category: 'Roofing', material: 'Hardwood Timber 4x4', description: 'Roof truss members',
      unit: 'length', quantity: q(roofArea * 0.12), unitPrice: PRICE.timber, total: q(roofArea * 0.12 * PRICE.timber),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.12 lengths/m² roof.`, linkedProductId: 'prod_7',
    },
    {
      category: 'Finishing', material: 'Ceramic Floor Tile 60x60', description: 'Polished porcelain',
      unit: 'm2', quantity: q(builtArea * 0.7), unitPrice: PRICE.tiles, total: q(builtArea * 0.7 * PRICE.tiles),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 70% of floor area tiled.`, linkedProductId: 'prod_4',
    },
    {
      category: 'Finishing', material: 'Interior Emulsion Paint 20L', description: 'Washable acrylic, matt',
      unit: 'bucket', quantity: q(builtArea / 250, 1), unitPrice: PRICE.paint, total: q((builtArea / 250) * PRICE.paint),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 1×20L bucket ≈ 250 m².`, linkedProductId: 'prod_5',
    },
    {
      category: 'Finishing', material: 'Ceiling Boards', description: 'Moisture-resistant ceiling panels',
      unit: 'm2', quantity: q(builtArea * 0.9), unitPrice: PRICE.ceiling, total: q(builtArea * 0.9 * PRICE.ceiling),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 90% of floor area.`, linkedProductId: null,
    },
    {
      category: 'Openings', material: 'Internal Door Set', description: 'Solid timber door + frame',
      unit: 'unit', quantity: q(rooms * 1.2), unitPrice: PRICE.door, total: q(rooms * 1.2 * PRICE.door),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 1.2 doors/room.`, linkedProductId: null,
    },
    {
      category: 'Openings', material: 'Aluminium Window', description: '1.2×1.2m sliding unit',
      unit: 'unit', quantity: q(rooms * 0.8), unitPrice: PRICE.window, total: q(rooms * 0.8 * PRICE.window),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.8 windows/room.`, linkedProductId: null,
    },
    {
      category: 'Openings', material: 'Insulated Glass Unit', description: 'Double-glazed low-e for façades',
      unit: 'm2', quantity: q(rooms * 0.9, 1), unitPrice: PRICE.glass, total: q(rooms * 0.9 * PRICE.glass),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.9 m² glazing/room.`, linkedProductId: 'prod_9',
    },
    {
      category: 'Plumbing', material: 'PVC Piping 110mm', description: 'uPVC drainage',
      unit: 'length', quantity: q(rooms * 0.6), unitPrice: PRICE.pipe, total: q(rooms * 0.6 * PRICE.pipe),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 0.6 lengths/room.`, linkedProductId: 'prod_8',
    },
    {
      category: 'Plumbing', material: 'Sanitary Fixture Set', description: 'WC + basin + shower',
      unit: 'set', quantity: q(Math.max(1, Math.round(rooms / 4))), unitPrice: PRICE.sanitary, total: q(Math.max(1, Math.round(rooms / 4)) * PRICE.sanitary),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 1 set per 4 rooms.`, linkedProductId: null,
    },
    {
      category: 'Electrical', material: 'Electrical Cable 2.5mm²', description: 'Copper PVC insulated, 100m',
      unit: 'roll', quantity: q(builtArea / 150, 1), unitPrice: PRICE.cable, total: q((builtArea / 150) * PRICE.cable),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 1 roll per 150 m².`, linkedProductId: 'prod_10',
    },
    {
      category: 'Electrical', material: 'Switches & Sockets', description: 'Modular wiring accessories',
      unit: 'unit', quantity: q(rooms * 4), unitPrice: PRICE.switchgear, total: q(rooms * 4 * PRICE.switchgear),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 4 accessories/room.`, linkedProductId: null,
    },
    {
      category: 'Electrical', material: 'Lighting Fixtures', description: 'LED recessed downlights',
      unit: 'unit', quantity: q(rooms * 2), unitPrice: PRICE.light, total: q(rooms * 2 * PRICE.light),
      source: 'AI_ESTIMATE', notes: `${ASSUMPTION_NOTE} 2 fixtures/room.`, linkedProductId: null,
    },
  ];
}

/** Sum an estimate into a grand total. */
export function estimateTotals(items: EstimateItem[]) {
  const total = items.reduce((s, i) => s + (i.total ?? 0), 0);
  const byCategory: Record<string, number> = {};
  for (const i of items) byCategory[i.category] = (byCategory[i.category] ?? 0) + (i.total ?? 0);
  return { total, byCategory, itemCount: items.length };
}
