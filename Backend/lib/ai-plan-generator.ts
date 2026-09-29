import { callGemini } from './gemini.ts';

export type ArchitectPlanRequirements = {
  buildingType: string;
  floors: number;
  sqft?: number;
  bedrooms: number;
  bathrooms: string;
  style: string;
  budget: number; // 1 Economy, 2 Standard, 3 Premium, 4 Luxury
  customPrompt?: string;
  location?: string;
};

export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bath'
  | 'dining'
  | 'balcony'
  | 'terrace'
  | 'garage'
  | 'pool'
  | 'hallway'
  | 'office'
  | 'utility';

export type Room3D = {
  id: string;
  name: string;
  type: RoomType;
  w: number;
  h: number;
  x: number;
  y: number;
  color?: string;
  material?: 'concrete' | 'timber' | 'glass' | 'marble' | 'brick' | 'tile' | 'water';
  features?: string[];
};

export type Floor3D = {
  floorIndex: number;
  name: string;
  elevation: number;
  height: number;
  rooms: Room3D[];
};

export type Plan3DResult = {
  projectName: string;
  concept: string;
  style: string;
  buildingType: string;
  floorsCount: number;
  totalAreaM2: number;
  estimatedCostXAF: number;
  estimatedTimelineWeeks: number;
  sustainabilityNotes: string[];
  structuralSystem: string;
  floors: Floor3D[];
  flatRooms2D: Room3D[];
  exterior: {
    roofType: 'flat_terrace' | 'pitched' | 'butterfly' | 'overhang_slab';
    roofColor: string;
    facadeColor: string;
    accentColor: string;
    wallFinish: string;
  };
  materialsSummary: {
    name: string;
    category: string;
    estimatedQty: string;
    unitCostXAF: number;
  }[];
};

const ROOM_COLORS: Record<RoomType, string> = {
  living: '#315C4C',
  bedroom: '#2A7A64',
  kitchen: '#D97706',
  bath: '#0284C7',
  dining: '#4F46E5',
  balcony: '#10B981',
  terrace: '#059669',
  garage: '#64748B',
  pool: '#38BDF8',
  hallway: '#94A3B8',
  office: '#7C3AED',
  utility: '#6B7280',
};

const BUDGET_RATES_XAF: Record<number, number> = {
  1: 50000,
  2: 80000,
  3: 130000,
  4: 210000,
};

/**
 * Procedural fallback layout generator for architectural plans.
 * Guarantees a valid, realistic architectural floor plan if Gemini is unreachable.
 */
function generateProceduralPlan(req: ArchitectPlanRequirements): Plan3DResult {
  const floorsCount = Math.max(1, Math.min(4, Number(req.floors) || 1));
  const bedrooms = Math.max(1, Number(req.bedrooms) || 3);
  const budget = Math.max(1, Math.min(4, req.budget || 2));
  const floorHeight = 3.2;

  const floors: Floor3D[] = [];

  // Ground Floor
  const groundRooms: Room3D[] = [
    {
      id: 'g-living',
      name: 'Grand Living Room',
      type: 'living',
      w: 6.5,
      h: 5.0,
      x: 0,
      y: 0,
      material: 'marble',
      color: ROOM_COLORS.living,
      features: ['large_openings', 'high_ceiling'],
    },
    {
      id: 'g-dining',
      name: 'Dining Hall',
      type: 'dining',
      w: 4.2,
      h: 3.8,
      x: 6.8,
      y: 0,
      material: 'marble',
      color: ROOM_COLORS.dining,
    },
    {
      id: 'g-kitchen',
      name: 'Chef Kitchen',
      type: 'kitchen',
      w: 4.2,
      h: 4.0,
      x: 6.8,
      y: 4.1,
      material: 'tile',
      color: ROOM_COLORS.kitchen,
      features: ['service_entrance'],
    },
    {
      id: 'g-entry',
      name: 'Entrance Foyer & Gallery',
      type: 'hallway',
      w: 2.8,
      h: 4.0,
      x: 0,
      y: 5.3,
      material: 'marble',
      color: ROOM_COLORS.hallway,
    },
    {
      id: 'g-powder',
      name: 'Guest Powder Room',
      type: 'bath',
      w: 2.2,
      h: 2.0,
      x: 3.1,
      y: 5.3,
      material: 'tile',
      color: ROOM_COLORS.bath,
    },
  ];

  if (floorsCount === 1) {
    // Add bedrooms on ground floor
    groundRooms.push({
      id: 'g-master',
      name: 'Master Suite',
      type: 'bedroom',
      w: 5.0,
      h: 4.5,
      x: 11.3,
      y: 0,
      material: 'timber',
      color: ROOM_COLORS.bedroom,
      features: ['ensuite_bath', 'private_veranda'],
    });
    for (let i = 1; i < bedrooms; i++) {
      groundRooms.push({
        id: `g-bed-${i}`,
        name: `Bedroom ${i + 1}`,
        type: 'bedroom',
        w: 3.8,
        h: 3.6,
        x: 11.3,
        y: 4.8 + (i - 1) * 3.9,
        material: 'timber',
        color: ROOM_COLORS.bedroom,
      });
    }
  } else {
    // Add garage/terrace on ground floor
    groundRooms.push({
      id: 'g-terrace',
      name: 'Covered Garden Terrace',
      type: 'terrace',
      w: 5.5,
      h: 3.5,
      x: 0,
      y: -3.8,
      material: 'concrete',
      color: ROOM_COLORS.terrace,
      features: ['shaded_pergola'],
    });

    if (req.customPrompt?.toLowerCase().includes('pool') || budget >= 3) {
      groundRooms.push({
        id: 'g-pool',
        name: 'Reflective Pool & Deck',
        type: 'pool',
        w: 6.0,
        h: 3.2,
        x: 6.0,
        y: -3.8,
        material: 'water',
        color: ROOM_COLORS.pool,
        features: ['timber_decking'],
      });
    }
  }

  floors.push({
    floorIndex: 0,
    name: 'Ground Floor',
    elevation: 0,
    height: floorHeight,
    rooms: groundRooms,
  });

  // Upper Floors
  for (let f = 1; f < floorsCount; f++) {
    const upperRooms: Room3D[] = [];
    if (f === 1) {
      upperRooms.push({
        id: `f${f}-master`,
        name: 'Executive Master Suite',
        type: 'bedroom',
        w: 5.5,
        h: 4.8,
        x: 0,
        y: 0,
        material: 'timber',
        color: ROOM_COLORS.bedroom,
        features: ['walk_in_closet', 'luxury_bath', 'balcony_access'],
      });
      upperRooms.push({
        id: `f${f}-balcony`,
        name: 'Master Cantilever Balcony',
        type: 'balcony',
        w: 5.5,
        h: 2.0,
        x: 0,
        y: -2.3,
        material: 'glass',
        color: ROOM_COLORS.balcony,
        features: ['glass_railing'],
      });

      const bedsOnLevel = Math.max(1, bedrooms - 1);
      for (let b = 0; b < bedsOnLevel; b++) {
        upperRooms.push({
          id: `f${f}-bed-${b + 1}`,
          name: `En-Suite Bedroom ${b + 2}`,
          type: 'bedroom',
          w: 4.0,
          h: 4.0,
          x: 5.8,
          y: b * 4.3,
          material: 'timber',
          color: ROOM_COLORS.bedroom,
        });
      }

      upperRooms.push({
        id: `f${f}-lounge`,
        name: 'Family Pyjama Lounge',
        type: 'living',
        w: 3.8,
        h: 3.5,
        x: 0,
        y: 5.1,
        material: 'timber',
        color: ROOM_COLORS.living,
      });
    } else {
      // 2nd floor / Penthouse terrace
      upperRooms.push({
        id: `f${f}-terrace`,
        name: 'Panoramic Sky Lounge & Roof Terrace',
        type: 'terrace',
        w: 8.0,
        h: 6.0,
        x: 0,
        y: 0,
        material: 'timber',
        color: ROOM_COLORS.terrace,
        features: ['bbq_station', 'solar_canopy'],
      });
      upperRooms.push({
        id: `f${f}-office`,
        name: 'Private Studio & Library',
        type: 'office',
        w: 4.5,
        h: 4.0,
        x: 8.3,
        y: 0,
        material: 'timber',
        color: ROOM_COLORS.office,
      });
    }

    floors.push({
      floorIndex: f,
      name: f === 1 ? 'First Floor' : `Floor ${f + 1}`,
      elevation: f * floorHeight,
      height: floorHeight,
      rooms: upperRooms,
    });
  }

  const totalAreaM2 = Math.round(
    floors.reduce(
      (acc, fl) => acc + fl.rooms.reduce((s, r) => s + r.w * r.h, 0),
      0,
    ),
  );

  const rate = BUDGET_RATES_XAF[budget] ?? 80000;
  const estimatedCostXAF = Math.round(totalAreaM2 * rate);
  const estimatedTimelineWeeks = Math.max(8, Math.ceil(Math.sqrt(totalAreaM2) * 1.5));

  return {
    projectName: `${req.buildingType} — ${req.style}`,
    concept: `A sophisticated ${req.style.toLowerCase()} concept designed for tropical climate efficiency. Incorporates generous shaded verandas, optimized cross-ventilation, expansive glazing with solar orientation, and seamless indoor-outdoor transitions.`,
    style: req.style,
    buildingType: req.buildingType,
    floorsCount,
    totalAreaM2,
    estimatedCostXAF,
    estimatedTimelineWeeks,
    sustainabilityNotes: [
      'Dual-aspect natural cross-ventilation eliminating thermal trapping',
      'Extended roof overhangs protecting exterior envelope from tropical rain and solar glare',
      'Rainwater harvesting channel integration on the roof slab',
      'Solar PV roof-ready orientation',
    ],
    structuralSystem: 'Reinforced concrete post-and-beam frame with thermal hollow-block infill and lightweight roof structure.',
    floors,
    flatRooms2D: groundRooms,
    exterior: {
      roofType: floorsCount > 1 ? 'flat_terrace' : 'overhang_slab',
      roofColor: '#2b3a36',
      facadeColor: '#F5F5F3',
      accentColor: '#315C4C',
      wallFinish: 'Smooth weather-resistant stucco with warm timber louvers',
    },
    materialsSummary: [
      { name: 'Reinforced Concrete (Foundation & Frame)', category: 'Structure', estimatedQty: `${Math.round(totalAreaM2 * 0.4)} m³`, unitCostXAF: 95000 },
      { name: 'Vibrated Concrete Blocks (15cm / 20cm)', category: 'Masonry', estimatedQty: `${Math.round(totalAreaM2 * 12)} pcs`, unitCostXAF: 450 },
      { name: 'High-Performance Double Glazing', category: 'Openings', estimatedQty: `${Math.round(totalAreaM2 * 0.25)} m²`, unitCostXAF: 35000 },
      { name: 'Treated Iroko Timber Cladding', category: 'Finishes', estimatedQty: `${Math.round(totalAreaM2 * 0.15)} m²`, unitCostXAF: 18000 },
      { name: 'Porcelain & Marble Floor Tiles', category: 'Finishes', estimatedQty: `${totalAreaM2} m²`, unitCostXAF: 12500 },
    ],
  };
}

/**
 * Generates an intelligent, fully structured 3D architectural plan from
 * requirements using Google Gemini AI, with automatic validation and procedural
 * fallback.
 */
export async function generateArchitecturalPlan3D(
  requirements: ArchitectPlanRequirements,
): Promise<Plan3DResult> {
  const systemInstruction = `You are BuildSmart AI's Lead Computational Architect and 3D Generative Engine.
Your task is to take architectural requirements and synthesize a complete, geometrically sound 2D and 3D architectural plan specification.

CRITICAL ARCHITECTURAL RULES:
1. Spatial Adjacency & Flow:
   - Living room must connect naturally to Dining and Entrance Foyer.
   - Kitchen connects to Dining and exterior service court.
   - Bedrooms are grouped into quiet private zones or private upper levels.
   - Master Bedroom features an en-suite bath and optional balcony.
2. Coordinates & Geometry:
   - Use a clean Cartesian metric coordinate system in meters (X = width axis, Y = depth axis).
   - Coordinates (x, y) represent the top-left corner of the room bounding box.
   - Rooms on the same floor MUST NOT overlap! They must snap or align adjacent to each other.
   - Provide realistic dimensions (e.g. Living: 5.5 - 7.5m, Master Bed: 4.2 - 6.0m, Regular Bed: 3.4 - 4.2m, Bath: 2.0 - 3.0m, Kitchen: 3.2 - 4.5m).
3. Multi-Storey Logic:
   - If floors > 1, place public/living areas on Ground Floor (floorIndex 0), and private suites/bedrooms/lounges on upper floors (floorIndex 1, 2).
   - Each floor has a floorIndex, elevation (e.g. 0, 3.2, 6.4), and height (typically 3.0 to 3.4m).
4. Realistic Regional & Climate Context:
   - Design for West/Central African climates: high rainfall, tropical sunlight, passive cooling, deep overhangs, cross-ventilation.
   - Provide estimated construction cost in XAF (Central African Francs) and timeline in weeks.
5. You MUST return pure, strictly valid JSON conforming to the JSON schema.`;

  const userPrompt = `Generate a complete 3D architectural plan specification for:
- Building Type: ${requirements.buildingType}
- Floors: ${requirements.floors}
- Approximate SqFt: ${requirements.sqft ?? 2500} sqft
- Bedrooms: ${requirements.bedrooms}
- Bathrooms: ${requirements.bathrooms}
- Architectural Style: ${requirements.style}
- Budget Tier: ${['Economy', 'Standard', 'Premium', 'Luxury'][requirements.budget - 1] ?? 'Standard'}
${requirements.customPrompt ? `- Specific Architect Requirements: ${requirements.customPrompt}` : ''}
${requirements.location ? `- Site Location: ${requirements.location}` : ''}

Output a JSON object matching this exact TypeScript structure:
{
  "projectName": "string",
  "concept": "string description of architectural concept and spatial hierarchy",
  "style": "string",
  "buildingType": "string",
  "floorsCount": number,
  "totalAreaM2": number,
  "estimatedCostXAF": number,
  "estimatedTimelineWeeks": number,
  "sustainabilityNotes": ["string"],
  "structuralSystem": "string",
  "floors": [
    {
      "floorIndex": 0,
      "name": "Ground Floor",
      "elevation": 0,
      "height": 3.2,
      "rooms": [
        {
          "id": "string",
          "name": "string",
          "type": "living" | "bedroom" | "kitchen" | "bath" | "dining" | "balcony" | "terrace" | "garage" | "pool" | "hallway" | "office",
          "w": number,
          "h": number,
          "x": number,
          "y": number,
          "material": "concrete" | "timber" | "glass" | "marble" | "brick" | "tile" | "water",
          "color": "string hex color",
          "features": ["string"]
        }
      ]
    }
  ],
  "exterior": {
    "roofType": "flat_terrace" | "pitched" | "butterfly" | "overhang_slab",
    "roofColor": "string hex",
    "facadeColor": "string hex",
    "accentColor": "string hex",
    "wallFinish": "string"
  },
  "materialsSummary": [
    {
      "name": "string",
      "category": "string",
      "estimatedQty": "string",
      "unitCostXAF": number
    }
  ]
}`;

  try {
    const res = await callGemini(
      systemInstruction,
      [{ role: 'user', content: userPrompt }],
      { jsonMode: true, temperature: 0.3, maxOutputTokens: 8192 },
    );

    let parsed: any;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      // Try cleaning markdown wrapping and repair unclosed JSON
      let cleaned = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const lastCloseBrace = cleaned.lastIndexOf('}');
      if (lastCloseBrace > 0) {
        cleaned = cleaned.slice(0, lastCloseBrace + 1);
      }
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Remove trailing commas before closing braces/brackets
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(cleaned);
      }
    }

    if (!parsed || !Array.isArray(parsed.floors) || parsed.floors.length === 0) {
      throw new Error('Malformed plan JSON returned by Gemini');
    }

    // Normalize and sanitize floors and rooms
    const sanitizedFloors: Floor3D[] = parsed.floors.map((fl: any, i: number) => {
      const floorIndex = fl.floorIndex ?? i;
      const elevation = Number(fl.elevation) || floorIndex * 3.2;
      const height = Number(fl.height) || 3.2;
      const rooms: Room3D[] = (fl.rooms ?? []).map((r: any, rIdx: number) => {
        const type: RoomType = ROOM_COLORS[r.type as RoomType] ? (r.type as RoomType) : 'living';
        return {
          id: r.id || `f${floorIndex}-r${rIdx}`,
          name: r.name || `Room ${rIdx + 1}`,
          type,
          w: Math.max(1.5, Number(r.w) || 4.0),
          h: Math.max(1.5, Number(r.h) || 4.0),
          x: Number(r.x) || 0,
          y: Number(r.y) || 0,
          material: r.material || 'concrete',
          color: r.color || ROOM_COLORS[type],
          features: Array.isArray(r.features) ? r.features : [],
        };
      });

      return {
        floorIndex,
        name: fl.name || (floorIndex === 0 ? 'Ground Floor' : `Floor ${floorIndex + 1}`),
        elevation,
        height,
        rooms,
      };
    });

    const flatRooms2D = sanitizedFloors[0]?.rooms ?? [];

    const totalAreaM2 =
      parsed.totalAreaM2 ??
      Math.round(
        sanitizedFloors.reduce(
          (acc, f) => acc + f.rooms.reduce((s, r) => s + r.w * r.h, 0),
          0,
        ),
      );

    const budgetTier = Math.max(1, Math.min(4, requirements.budget || 2));
    const estimatedCostXAF =
      parsed.estimatedCostXAF ?? Math.round(totalAreaM2 * (BUDGET_RATES_XAF[budgetTier] || 80000));

    return {
      projectName: parsed.projectName || `${requirements.buildingType} — ${requirements.style}`,
      concept: parsed.concept || 'AI-generated high-efficiency architectural concept tailored to site orientation and functional brief.',
      style: parsed.style || requirements.style,
      buildingType: parsed.buildingType || requirements.buildingType,
      floorsCount: sanitizedFloors.length,
      totalAreaM2,
      estimatedCostXAF,
      estimatedTimelineWeeks: parsed.estimatedTimelineWeeks || Math.max(6, Math.ceil(Math.sqrt(totalAreaM2) * 1.4)),
      sustainabilityNotes: Array.isArray(parsed.sustainabilityNotes)
        ? parsed.sustainabilityNotes
        : ['Cross-ventilation', 'Solar ready', 'Rainwater harvesting'],
      structuralSystem: parsed.structuralSystem || 'Reinforced concrete post & slab system with masonry infill.',
      floors: sanitizedFloors,
      flatRooms2D,
      exterior: {
        roofType: parsed.exterior?.roofType || (sanitizedFloors.length > 1 ? 'flat_terrace' : 'overhang_slab'),
        roofColor: parsed.exterior?.roofColor || '#23312e',
        facadeColor: parsed.exterior?.facadeColor || '#F7F6F2',
        accentColor: parsed.exterior?.accentColor || '#315C4C',
        wallFinish: parsed.exterior?.wallFinish || 'Weather-resistant smooth acrylic stucco',
      },
      materialsSummary: Array.isArray(parsed.materialsSummary) && parsed.materialsSummary.length
        ? parsed.materialsSummary
        : [
            { name: 'Reinforced Concrete (Grade 25)', category: 'Structure', estimatedQty: `${Math.round(totalAreaM2 * 0.38)} m³`, unitCostXAF: 95000 },
            { name: 'Hollow Concrete Blocks', category: 'Masonry', estimatedQty: `${Math.round(totalAreaM2 * 11)} pcs`, unitCostXAF: 450 },
            { name: 'Double-glazed Aluminum Joinery', category: 'Openings', estimatedQty: `${Math.round(totalAreaM2 * 0.22)} m²`, unitCostXAF: 32000 },
          ],
    };
  } catch (err) {
    console.warn('[ai-plan-generator] Gemini generation encountered error, falling back to procedural engine:', err);
    return generateProceduralPlan(requirements);
  }
}

/**
 * Mutates an existing 3D plan based on natural language feedback from the architect.
 */
export async function mutateArchitecturalPlan(
  currentPlan: Plan3DResult,
  instruction: string,
): Promise<{ reply: string; updatedPlan: Plan3DResult }> {
  const systemInstruction = `You are BuildSmart AI's Interactive Design Studio Copilot.
The architect has an existing 3D plan and has issued a refinement instruction.
Analyze the instruction, adjust the rooms, materials, or dimensions where needed, and provide both an explanatory message and the updated plan JSON.

Always return a JSON object:
{
  "reply": "string explanation of what changes were made and architectural rationale",
  "updatedPlan": { ...Plan3DResult conformant JSON... }
}`;

  const prompt = `Current Plan:
${JSON.stringify({
  projectName: currentPlan.projectName,
  style: currentPlan.style,
  floorsCount: currentPlan.floorsCount,
  floors: currentPlan.floors,
  exterior: currentPlan.exterior,
})}

Architect Refinement Instruction:
"${instruction}"

Output the JSON with "reply" and "updatedPlan".`;

  try {
    const res = await callGemini(
      systemInstruction,
      [{ role: 'user', content: prompt }],
      { jsonMode: true, temperature: 0.3, maxOutputTokens: 6000 },
    );

    const parsed = JSON.parse(res.text);
    if (parsed.updatedPlan && Array.isArray(parsed.updatedPlan.floors)) {
      return {
        reply: parsed.reply || 'Plan updated with your requested modifications.',
        updatedPlan: {
          ...currentPlan,
          ...parsed.updatedPlan,
          flatRooms2D: parsed.updatedPlan.floors[0]?.rooms ?? currentPlan.flatRooms2D,
        },
      };
    }
  } catch (err) {
    console.warn('[ai-plan-generator] Plan mutation failed, providing fallback assistance:', err);
  }

  return {
    reply: `I have noted your request: "${instruction}". You can fine-tune individual room dimensions in the layout inspector or adjust the requirements to generate an updated iteration.`,
    updatedPlan: currentPlan,
  };
}
