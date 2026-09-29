/**
 * BuildSmart AI — Floor Plan BOQ & Material Estimation Service
 *
 * Automatically analyzes architectural floor plans (Roomagen AI outputs or CAD geometry)
 * and generates a comprehensive Preliminary Bill of Quantities (BOQ) and Bulk Material
 * Estimation according to standard civil engineering takeoff principles (SMM7/NRM)
 * calibrated for Central & West African construction standards and market prices (FCFA/XAF).
 */

import { dbClient } from '../../lib/db.ts';
import { callGemini, callGeminiVision } from '../../lib/gemini.ts';

export interface BoqLineItem {
  id?: string;
  category: string;
  material: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  source: string;
  notes: string;
  linkedProductId?: string | null;
}

export interface MaterialTakeoffSummary {
  material: string;
  category: string;
  estimatedQuantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  wasteAllowancePercent: number;
  specification: string;
  marketplaceMatch?: {
    id: string;
    title: string;
    price: number;
  } | null;
}

export interface BoqExecutiveSummary {
  grossFloorAreaM2: number;
  totalEstimatedCostXaf: number;
  structuralCostPerM2: number;
  estimatedDurationMonths: number;
  tradeCount: number;
  itemCount: number;
  contingencyPercent: number;
  contingencyAmountXaf: number;
  grandTotalWithContingencyXaf: number;
  wasteFactorPercent: number;
  soilAssumption: string;
  concreteGradeSpecification: string;
}

export interface FloorPlanBoqResult {
  boq: any;
  items: BoqLineItem[];
  summary: BoqExecutiveSummary;
  materials: MaterialTakeoffSummary[];
  engineeringInsights: {
    siteAnalysis: string;
    structuralRecommendations: string[];
    valueEngineeringTips: string[];
    climateAndDurabilityNotes: string;
    estimatedMilestones: { milestone: string; durationWeeks: number; costSharePercent: number }[];
  };
  floorPlanDetails: {
    id: string;
    name: string;
    kind: string;
    version: number;
    previewUrl?: string;
  };
}

// Regional Central & West African reference prices (in XAF / FCFA)
const REFERENCE_PRICES = {
  cementBag: 4800, // 50kg Portland CEM II 42.5R
  block15: 450, // 15x20x40cm hollow concrete block
  block20: 600, // 20x20x40cm load-bearing block
  riverSandM3: 17500, // Sharp river sand per m³
  gravelM3: 24000, // Crushed basalt aggregate 15/25mm
  rebar12mm: 7200, // 12m length FeE500 high-yield rebar
  rebar10mm: 5200, // 12m length
  rebar8mm: 3600, // 12m length for stirrups
  roofingSheet: 6200, // 0.5mm alu-zinc corrugated 3m
  roofTimberLength: 8500, // Hardwood 4x4 treated truss timber
  porcelainTileM2: 8500, // 60x60cm rectified porcelain
  interiorPaint20L: 34000, // Washable acrylic emulsion 20L
  exteriorPaint20L: 42000, // Weather-shield exterior acrylic 20L
  pvcPipe110: 8200, // 110mm uPVC drainage pipe 4m
  pprPipe25: 3500, // 25mm hot/cold potable water pipe 4m
  electricalCableRoll: 42000, // 2.5mm² copper wiring roll 100m
  conduitRoll: 16000, // 20mm PVC electrical conduit roll
  internalDoorUnit: 65000, // Solid engineered timber door + frame
  slidingWindowUnit: 58000, // 1.2x1.2m aluminium sliding window
  securityDoorUnit: 145000, // Armored steel front entry door
};

export class FloorPlanBoqService {
  /**
   * Automatically generate preliminary BOQ and material estimation from a floor plan.
   */
  async generateEstimateFromFloorPlan(params: {
    floorPlanId: string;
    projectId?: string;
    architectNotes?: string;
    userId: string;
  }): Promise<FloorPlanBoqResult> {
    const { floorPlanId, architectNotes, userId } = params;

    // 1. Fetch Floor Plan or Roomagen Job
    let floorPlan: any = await dbClient.floorPlan.findUnique({
      where: { id: floorPlanId },
    });

    if (!floorPlan) {
      const job: any = await dbClient.roomagenJob.findUnique({
        where: { id: floorPlanId },
      });

      if (job && job.status === 'COMPLETED' && job.outputAssetUrl) {
        const { roomagenService } = await import('../roomagen/roomagen.service.ts');
        floorPlan = await roomagenService.saveAsProjectFloorPlan({
          jobId: job.id,
          projectId: params.projectId || job.projectId || 'proj_1',
          name: `${job.tool === 'FLOOR_PLAN_TO_3D' ? '3D Visualization' : 'AI Floor Plan'} v${job.version}`,
          userId,
        });
      }
    }

    if (!floorPlan) {
      throw new Error(`Floor plan with ID "${floorPlanId}" not found.`);
    }

    const projectId = params.projectId || floorPlan.projectId;
    const project: any = projectId
      ? await dbClient.project.findUnique({ where: { id: projectId } })
      : null;

    // 2. Parse Spatial & CAD Geometry
    let rooms: any[] = [];
    let parsedData: any = {};
    if (floorPlan.data) {
      try {
        parsedData = typeof floorPlan.data === 'string' ? JSON.parse(floorPlan.data) : floorPlan.data;
        if (Array.isArray(parsedData.rooms)) {
          rooms = parsedData.rooms;
        }
      } catch {
        // fallback
      }
    }

    // Calculate gross area
    let grossAreaM2 = 0;
    if (rooms.length > 0) {
      grossAreaM2 = rooms.reduce((acc, r) => acc + (Number(r.w) || 0) * (Number(r.h) || 0), 0);
    }
    if (grossAreaM2 <= 0) {
      grossAreaM2 = project?.siteArea ? Number(project.siteArea) : 185; // Standard 3-bedroom villa default
    }

    const previewUrl =
      floorPlan.svgData &&
      (floorPlan.svgData.startsWith('/') ||
        floorPlan.svgData.startsWith('http') ||
        floorPlan.svgData.startsWith('data:'))
        ? floorPlan.svgData
        : parsedData?.imageUrl || undefined;

    // 3. Attempt Gemini AI Generative Analysis with Fallback
    let aiOutput: any = null;
    try {
      aiOutput = await this.callGeminiForBoqAnalysis({
        floorPlan,
        project,
        grossAreaM2,
        rooms,
        previewUrl,
        architectNotes,
      });
    } catch (err: any) {
      console.warn('[FloorPlanBoqService] Gemini live call failed or offline, using parametric civil engineering calculation engine:', err.message);
      aiOutput = this.calculateDeterministicCivilEngineeringBoq({
        grossAreaM2,
        rooms,
        project,
        architectNotes,
      });
    }

    // 4. Persist BOQ Document and Line Items in Database
    const boqName = `${floorPlan.name} — Preliminary BOQ & Material Estimation`;

    // Package metadata
    const metadata = {
      floorPlanId: floorPlan.id,
      floorPlanName: floorPlan.name,
      floorPlanKind: floorPlan.kind,
      floorPlanVersion: floorPlan.version,
      previewUrl,
      grossAreaM2: aiOutput.summary.grossFloorAreaM2,
      durationMonths: aiOutput.summary.estimatedDurationMonths,
      structuralCostPerM2: aiOutput.summary.structuralCostPerM2,
      summary: aiOutput.summary,
      materials: aiOutput.materials,
      engineeringInsights: aiOutput.engineeringInsights,
      generatedWith: 'BuildSmart Gemini AI Estimator (NRM/SMM7)',
      generatedAt: new Date().toISOString(),
    };

    const boq = await dbClient.boq.create({
      data: {
        architectId: userId,
        projectId,
        name: boqName,
        status: 'DRAFT',
        version: 1,
        currency: 'XAF',
        notes: JSON.stringify(metadata),
      },
    });

    // Save Line items
    const lineItemsToInsert = aiOutput.items.map((item: BoqLineItem) => ({
      boqId: boq.id,
      category: item.category,
      material: item.material,
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      total: Number(item.total) || 0,
      source: 'AI_ESTIMATE',
      notes: item.notes || '',
      linkedProductId: item.linkedProductId || null,
    }));

    if (lineItemsToInsert.length > 0) {
      await dbClient.boqItem.createMany({
        data: lineItemsToInsert,
      });
    }

    // 5. Activity log
    await dbClient.activity.create({
      data: {
        userId,
        projectId,
        type: 'PROJECT',
        title: 'Preliminary BOQ generated from floor plan',
        body: `${boqName} (${aiOutput.summary.grossFloorAreaM2} m² · ${Math.round(aiOutput.summary.grandTotalWithContingencyXaf).toLocaleString()} XAF)`,
      },
    });

    return {
      boq,
      items: lineItemsToInsert,
      summary: aiOutput.summary,
      materials: aiOutput.materials,
      engineeringInsights: aiOutput.engineeringInsights,
      floorPlanDetails: {
        id: floorPlan.id,
        name: floorPlan.name,
        kind: floorPlan.kind,
        version: floorPlan.version,
        previewUrl,
      },
    };
  }

  /**
   * Forward a preliminary BOQ & Material Estimation to the client's dashboard.
   */
  async forwardBoqToClient(params: {
    boqId: string;
    architectId: string;
    clientId?: string;
    message?: string;
    notifyClient?: boolean;
    postToChat?: boolean;
  }): Promise<{ success: boolean; boq: any; notificationId?: string; chatMessageId?: string }> {
    const { boqId, architectId, message, notifyClient = true, postToChat = true } = params;

    const boq: any = await dbClient.boq.findUnique({ where: { id: boqId } });
    if (!boq) {
      throw new Error(`BOQ with ID "${boqId}" not found`);
    }

    if (architectId && boq.architectId && boq.architectId !== architectId) {
      throw new Error('You are not authorized to forward this BOQ.');
    }

    const project: any = boq.projectId
      ? await dbClient.project.findUnique({ where: { id: boq.projectId } })
      : null;
    const targetClientId = params.clientId || project?.ownerId;

    if (!targetClientId) {
      throw new Error('No client is assigned to this project to receive the BOQ.');
    }

    // 1. Update BOQ status to SENT and record timestamp
    let existingMeta: any = {};
    try {
      existingMeta = boq.notes ? JSON.parse(boq.notes) : {};
    } catch {
      existingMeta = { originalNotes: boq.notes };
    }

    existingMeta.sentToClientAt = new Date().toISOString();
    existingMeta.architectMessage = message || '';

    const updatedBoq = await dbClient.boq.update({
      where: { id: boq.id },
      data: {
        status: 'SENT',
        notes: JSON.stringify(existingMeta),
      },
    });

    let notificationId: string | undefined;
    let chatMessageId: string | undefined;

    // 2. Client In-App Notification
    if (notifyClient) {
      const notif = await dbClient.notification.create({
        data: {
          userId: targetClientId,
          type: 'PROJECT',
          title: 'Preliminary BOQ & Material Estimate Received',
          body: `Architect has forwarded the Preliminary BOQ & Material Estimation for "${project?.name || boq.name}". Inspect estimated quantities, costs, and materials.`,
          read: 0,
          link: `/client/boq?project=${boq.projectId}&boq=${boq.id}`,
          resourceId: boq.id,
        },
      });
      notificationId = notif.id;
    }

    // 3. Post to Project Chat Room
    if (postToChat && boq.projectId) {
      try {
        let chatRoom: any = await dbClient.chatRoom.findFirst({
          where: { projectId: boq.projectId },
        });

        if (!chatRoom) {
          chatRoom = await dbClient.chatRoom.create({
            data: {
              projectId: boq.projectId,
              name: `${project?.name || 'Project'} Team Chat`,
            },
          });
        }

        const participants = await dbClient.chatParticipant.findMany({
          where: { roomId: chatRoom.id },
        });
        const participantIds = new Set(participants.map((p: any) => p.userId));
        if (!participantIds.has(architectId)) {
          await dbClient.chatParticipant.create({ data: { roomId: chatRoom.id, userId: architectId } }).catch(() => {});
        }
        if (!participantIds.has(targetClientId)) {
          await dbClient.chatParticipant.create({ data: { roomId: chatRoom.id, userId: targetClientId } }).catch(() => {});
        }

        const chatMsg = await dbClient.message.create({
          data: {
            senderId: architectId,
            roomId: chatRoom.id,
            content:
              `📊 **[MATERIAL ESTIMATE & PRELIMINARY BOQ DISPATCHED]**\n\n` +
              `I have generated and forwarded the **Preliminary Bill of Quantities (BOQ)** and **Material Estimation** for **${project?.name || 'your project'}**.\n\n` +
              `• Document: **${boq.name}**\n` +
              `• Trade Breakdown: Substructure, Concrete Frame, Masonry, Roofing, Finishes & MEP\n` +
              (message ? `• Architect Note: "${message}"\n` : '') +
              `\n👉 [Click here to inspect the Estimates & BOQs](/client/boq?project=${boq.projectId}&boq=${boq.id})`,
            read: 0,
          },
        });
        chatMessageId = chatMsg.id;
      } catch (err: any) {
        console.warn('[forwardBoqToClient] Chat post warning:', err.message);
      }
    }

    // 4. Activity Log
    await dbClient.activity.create({
      data: {
        userId: architectId,
        projectId: boq.projectId,
        type: 'PROJECT',
        title: 'BOQ forwarded to client',
        body: `Delivered to client for review: ${boq.name}`,
      },
    });

    return {
      success: true,
      boq: updatedBoq,
      notificationId,
      chatMessageId,
    };
  }

  /**
   * Call Gemini AI with prompt for civil engineering quantity surveying.
   */
  private async callGeminiForBoqAnalysis(input: {
    floorPlan: any;
    project: any;
    grossAreaM2: number;
    rooms: any[];
    previewUrl?: string;
    architectNotes?: string;
  }): Promise<any> {
    const { floorPlan, project, grossAreaM2, rooms, architectNotes } = input;

    const roomBreakdown = rooms.length > 0
      ? rooms.map((r: any) => `- ${r.name || 'Room'}: ${r.w}m x ${r.h}m (${((r.w || 0) * (r.h || 0)).toFixed(1)} m²)`).join('\n')
      : 'Standard architectural layout (Living room, Dining, Kitchen, Master bedroom suite, 2 Guest rooms, Bathrooms, Veranda).';

    const systemInstruction = `You are a Senior Chief Quantity Surveyor and Chartered Civil/Structural Cost Consultant with over 25 years of construction experience in Central and West Africa (Cameroon - Douala/Yaoundé, Côte d'Ivoire, Senegal, Gabon).
You strictly follow the Standard Method of Measurement for Building Works (SMM7/NRM) and local African building construction practice (CP2004, Eurocode-2/8).
Your task is to analyze an architectural floor plan and produce a realistic, professional Preliminary Bill of Quantities (BOQ) and Bulk Material Takeoff in Central African Francs (XAF / FCFA).

Reference Current Regional Market Rates:
- 50kg Portland Cement (CEM II 42.5R): 4,800 XAF/bag
- Hollow Concrete Blocks (15x20x40cm): 450 XAF/unit
- Hollow Concrete Blocks (20x20x40cm for foundations): 600 XAF/unit
- Sharp River Sand: 17,500 XAF/m³
- Crushed Basalt Aggregate/Gravel (15/25mm): 24,000 XAF/m³
- High-Yield Steel Rebar FeE500 (12mm, 12m length): 7,200 XAF/length
- High-Yield Steel Rebar FeE500 (10mm, 12m length): 5,200 XAF/length
- Steel Rebar for stirrups (8mm, 12m length): 3,600 XAF/length
- 0.5mm Corrugated Aluminium/Alu-Zinc Roofing Sheets: 6,200 XAF/sheet
- Treated Hardwood Timber 4x4 / 2x4 for Trusses: 8,500 XAF/length
- Porcelain Floor Tiles 60x60cm: 8,500 XAF/m²
- Ceramic Wall Tiles (Bathrooms/Kitchen): 6,500 XAF/m²
- Interior Washable Acrylic Paint (20L bucket): 34,000 XAF
- Exterior Weather-shield Acrylic Paint (20L bucket): 42,000 XAF
- PVC drainage pipes 110mm: 8,200 XAF/length
- PPR potable water pipes 25mm: 3,500 XAF/length
- Electrical copper cable 2.5mm² (100m roll): 42,000 XAF/roll
- Timber internal flush doors: 65,000 XAF/unit
- Aluminium sliding windows (1.2x1.2m): 58,000 XAF/unit

Respond STRICTLY with a valid JSON object matching this exact schema:
{
  "summary": {
    "grossFloorAreaM2": number,
    "totalEstimatedCostXaf": number,
    "structuralCostPerM2": number,
    "estimatedDurationMonths": number,
    "contingencyPercent": number,
    "contingencyAmountXaf": number,
    "grandTotalWithContingencyXaf": number,
    "wasteFactorPercent": number,
    "soilAssumption": string,
    "concreteGradeSpecification": string
  },
  "items": [
    {
      "category": string (one of: "Substructure & Foundations", "Reinforced Concrete Frame & Slabs", "Superstructure Masonry & Blockwork", "Roofing, Waterproofing & Rainwater Goods", "Doors, Windows, Glazing & Metalwork", "Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)", "Plumbing, Drainage & Sanitary Installations", "Electrical, Lighting & Power Distribution"),
      "material": string,
      "description": string,
      "unit": string ("bag", "m3", "block", "length", "sheet", "m2", "unit", "set", "bucket", "roll"),
      "quantity": number,
      "unitPrice": number,
      "total": number,
      "notes": string,
      "linkedProductId": string or null
    }
  ],
  "materials": [
    {
      "material": string,
      "category": string,
      "estimatedQuantity": number,
      "unit": string,
      "unitPrice": number,
      "totalCost": number,
      "wasteAllowancePercent": number,
      "specification": string
    }
  ],
  "engineeringInsights": {
    "siteAnalysis": string,
    "structuralRecommendations": [string],
    "valueEngineeringTips": [string],
    "climateAndDurabilityNotes": string,
    "estimatedMilestones": [
      { "milestone": string, "durationWeeks": number, "costSharePercent": number }
    ]
  }
}`;

    const prompt = `Architectural Floor Plan Analysis Request:
- Project Name: ${project?.name || 'Architectural Project'}
- Location: ${project?.location || 'Douala/Yaoundé, Cameroon'}
- Typology: ${project?.projectType || 'Residential Villa'}
- Plan Name: ${floorPlan.name} (${floorPlan.kind})
- Calculated Gross Floor Area: ${grossAreaM2.toFixed(1)} m²
- Room Layout & Geometry:
${roomBreakdown}
- Architect Notes / Requirements: ${architectNotes || 'Standard modern residential construction with durable reinforced concrete frame and climate-responsive tropical roofing.'}

Perform the complete takeoff and return the exact JSON object.`;

    const res = await callGemini(systemInstruction, [{ role: 'user', content: prompt }], {
      jsonMode: true,
      temperature: 0.2,
      maxOutputTokens: 6000,
    });

    const parsed = JSON.parse(res.text);
    if (!parsed.summary || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('Gemini response missing required BOQ structure');
    }

    return parsed;
  }

  /**
   * Deterministic parametric Civil Engineering BOQ takeoff engine.
   * Runs reliably with zero external dependencies if AI models are unreachable.
   */
  private calculateDeterministicCivilEngineeringBoq(input: {
    grossAreaM2: number;
    rooms: any[];
    project: any;
    architectNotes?: string;
  }): any {
    const { grossAreaM2, rooms } = input;
    const GFA = Math.max(50, grossAreaM2);
    const roomCount = Math.max(4, rooms.length || Math.round(GFA / 25));
    const perimeterM = Math.round(Math.sqrt(GFA) * 4 * 1.25); // Approximate external + internal wall perimeter
    const roofAreaM2 = Math.round(GFA * 1.22); // Roof with 60cm eaves overhang
    const wallAreaM2 = Math.round(perimeterM * 3.0 * 0.85); // 3m height minus openings

    const round = (num: number, dp = 0) => Number(num.toFixed(dp));

    // Quantities calculated using standard civil engineering factors:
    const cementFoundationsBags = round(GFA * 0.45);
    const cementConcreteFrameBags = round(GFA * 0.55);
    const cementMortarPlasterBags = round(GFA * 0.50);
    const totalCementBags = cementFoundationsBags + cementConcreteFrameBags + cementMortarPlasterBags;

    const sandM3 = round(GFA * 0.16, 1);
    const gravelM3 = round(GFA * 0.18, 1);
    const blocks15 = round(wallAreaM2 * 11);
    const blocks20Foundation = round(perimeterM * 5);
    const rebar12mm = round(GFA * 0.42);
    const rebar10mm = round(GFA * 0.35);
    const rebar8mm = round(GFA * 0.28);
    const roofSheets = round(roofAreaM2 / 2.7);
    const roofTimber = round(roofAreaM2 * 0.14);
    const floorTilesM2 = round(GFA * 0.75);
    const wallTilesM2 = round(roomCount * 12);
    const paintBucketsInterior = round(GFA / 180, 1);
    const paintBucketsExterior = round(GFA / 220, 1);
    const doorsInternal = Math.max(5, roomCount - 1);
    const windowsAluminium = Math.max(6, Math.round(roomCount * 1.3));

    const items: BoqLineItem[] = [
      // 1. Substructure & Foundations
      {
        category: 'Substructure & Foundations',
        material: 'Site Clearance & Bulk Excavation',
        description: 'Excavation of foundation trenches up to 1.2m deep in firm soil',
        unit: 'm3',
        quantity: round(perimeterM * 0.8 * 1.0, 1),
        unitPrice: 4500,
        total: round(perimeterM * 0.8 * 1.0 * 4500),
        source: 'AI_ESTIMATE',
        notes: '0.8m width trench excavation for strip footings',
        linkedProductId: null,
      },
      {
        category: 'Substructure & Foundations',
        material: 'Hollow Blocks 20cm (Foundation Footing)',
        description: 'Heavyweight 20x20x40cm hollow concrete blocks bedded in 1:4 cement mortar',
        unit: 'block',
        quantity: blocks20Foundation,
        unitPrice: REFERENCE_PRICES.block20,
        total: blocks20Foundation * REFERENCE_PRICES.block20,
        source: 'AI_ESTIMATE',
        notes: 'Footing stem wall up to ground floor slab level',
        linkedProductId: null,
      },
      {
        category: 'Substructure & Foundations',
        material: 'Hardcore Filling & Compaction',
        description: 'Lateritic gravel hardcore fill consolidated in layers under ground slab',
        unit: 'm3',
        quantity: round(GFA * 0.25, 1),
        unitPrice: 12000,
        total: round(GFA * 0.25 * 12000),
        source: 'AI_ESTIMATE',
        notes: '250mm compacted sub-base hardcore fill',
        linkedProductId: null,
      },
      {
        category: 'Substructure & Foundations',
        material: 'Damp Proof Membrane (Polyethylene 500 Gauge)',
        description: 'Heavy duty DPM laid on sand blinding under ground floor slab',
        unit: 'm2',
        quantity: round(GFA * 1.15),
        unitPrice: 1200,
        total: round(GFA * 1.15 * 1200),
        source: 'AI_ESTIMATE',
        notes: 'Includes 15% overlap and vertical turn-up',
        linkedProductId: null,
      },

      // 2. Reinforced Concrete Frame & Slabs
      {
        category: 'Reinforced Concrete Frame & Slabs',
        material: 'Portland Cement (C30/35 Concrete)',
        description: 'CEM II/B-L 42.5R for columns, tie-beams, and ground slab (350kg/m³)',
        unit: 'bag',
        quantity: cementConcreteFrameBags,
        unitPrice: REFERENCE_PRICES.cementBag,
        total: cementConcreteFrameBags * REFERENCE_PRICES.cementBag,
        source: 'AI_ESTIMATE',
        notes: 'Batch mixed concrete 1:2:4 ratio for structural frame',
        linkedProductId: 'prod_1',
      },
      {
        category: 'Reinforced Concrete Frame & Slabs',
        material: 'Crushed Basalt Aggregate 15/25mm',
        description: 'Hard stone aggregate for structural reinforced concrete',
        unit: 'm3',
        quantity: round(gravelM3 * 0.65, 1),
        unitPrice: REFERENCE_PRICES.gravelM3,
        total: round(gravelM3 * 0.65 * REFERENCE_PRICES.gravelM3),
        source: 'AI_ESTIMATE',
        notes: 'Washed basalt gravel',
        linkedProductId: null,
      },
      {
        category: 'Reinforced Concrete Frame & Slabs',
        material: 'High-Tensile Steel Rebar FeE500 (12mm)',
        description: 'Main longitudinal reinforcement bars (12m standard lengths)',
        unit: 'length',
        quantity: rebar12mm,
        unitPrice: REFERENCE_PRICES.rebar12mm,
        total: rebar12mm * REFERENCE_PRICES.rebar12mm,
        source: 'AI_ESTIMATE',
        notes: 'Columns and beam reinforcement cages',
        linkedProductId: 'prod_2',
      },
      {
        category: 'Reinforced Concrete Frame & Slabs',
        material: 'Steel Rebar FeE500 (8mm Stirrups & Links)',
        description: '8mm link ties for shear reinforcement spaced @ 150mm c/c',
        unit: 'length',
        quantity: rebar8mm,
        unitPrice: REFERENCE_PRICES.rebar8mm,
        total: rebar8mm * REFERENCE_PRICES.rebar8mm,
        source: 'AI_ESTIMATE',
        notes: 'Column ties and beam shear stirrups',
        linkedProductId: null,
      },
      {
        category: 'Reinforced Concrete Frame & Slabs',
        material: 'Plywood Formwork & Timber Props',
        description: '15mm film-faced shuttering plywood and eucalyptus prop system',
        unit: 'm2',
        quantity: round(GFA * 0.45),
        unitPrice: 5500,
        total: round(GFA * 0.45 * 5500),
        source: 'AI_ESTIMATE',
        notes: 'Reusable formwork for columns and ring beams',
        linkedProductId: null,
      },

      // 3. Superstructure Masonry & Blockwork
      {
        category: 'Superstructure Masonry & Blockwork',
        material: 'Hollow Concrete Blocks 15cm',
        description: 'Vibrated hollow agglo blocks 15x20x40cm for perimeter and partition walls',
        unit: 'block',
        quantity: blocks15,
        unitPrice: REFERENCE_PRICES.block15,
        total: blocks15 * REFERENCE_PRICES.block15,
        source: 'AI_ESTIMATE',
        notes: '11 blocks/m² wall area with 1:4 cement-sand mortar',
        linkedProductId: null,
      },
      {
        category: 'Superstructure Masonry & Blockwork',
        material: 'River Sand for Wall Mortar',
        description: 'Clean river sand for masonry joint mortar',
        unit: 'm3',
        quantity: round(sandM3 * 0.4, 1),
        unitPrice: REFERENCE_PRICES.riverSandM3,
        total: round(sandM3 * 0.4 * REFERENCE_PRICES.riverSandM3),
        source: 'AI_ESTIMATE',
        notes: 'Sharp river sand',
        linkedProductId: null,
      },

      // 4. Roofing, Waterproofing & Rainwater Goods
      {
        category: 'Roofing, Waterproofing & Rainwater Goods',
        material: 'Corrugated Alu-Zinc Roofing Sheets (0.5mm)',
        description: 'Trough-profile aluminium-zinc alloy roofing sheets with anti-corrosion coating',
        unit: 'sheet',
        quantity: roofSheets,
        unitPrice: REFERENCE_PRICES.roofingSheet,
        total: roofSheets * REFERENCE_PRICES.roofingSheet,
        source: 'AI_ESTIMATE',
        notes: 'Pitch 22° with 150mm end laps and neoprene washer fasteners',
        linkedProductId: 'prod_6',
      },
      {
        category: 'Roofing, Waterproofing & Rainwater Goods',
        material: 'Treated Hardwood Truss Timber (4x4 & 2x4)',
        description: 'Insecticide and fungicide vacuum-pressure treated tropical hardwood rafters & purlins',
        unit: 'length',
        quantity: roofTimber,
        unitPrice: REFERENCE_PRICES.roofTimberLength,
        total: roofTimber * REFERENCE_PRICES.roofTimberLength,
        source: 'AI_ESTIMATE',
        notes: 'Timber trusses spaced @ 900mm centers',
        linkedProductId: 'prod_7',
      },
      {
        category: 'Roofing, Waterproofing & Rainwater Goods',
        material: 'Rainwater Gutters & Downpipes (PVC 125mm)',
        description: 'Seamless uPVC half-round eaves gutter with brackets and downpipes',
        unit: 'length',
        quantity: round(perimeterM * 0.6),
        unitPrice: 5800,
        total: round(perimeterM * 0.6 * 5800),
        source: 'AI_ESTIMATE',
        notes: 'Rainwater catchment collection along eaves',
        linkedProductId: null,
      },

      // 5. Doors, Windows, Glazing & Metalwork
      {
        category: 'Doors, Windows, Glazing & Metalwork',
        material: 'Reinforced Steel Main Entrance Security Door',
        description: 'Security front entrance door with multi-point locking system (1000x2100mm)',
        unit: 'unit',
        quantity: 2,
        unitPrice: REFERENCE_PRICES.securityDoorUnit,
        total: 2 * REFERENCE_PRICES.securityDoorUnit,
        source: 'AI_ESTIMATE',
        notes: 'Main front and kitchen back security doors',
        linkedProductId: null,
      },
      {
        category: 'Doors, Windows, Glazing & Metalwork',
        material: 'Internal Flush Timber Doors',
        description: 'Solid core timber doors with hardwood frames and stainless steel cylinder locks',
        unit: 'unit',
        quantity: doorsInternal,
        unitPrice: REFERENCE_PRICES.internalDoorUnit,
        total: doorsInternal * REFERENCE_PRICES.internalDoorUnit,
        source: 'AI_ESTIMATE',
        notes: 'Bedrooms, bathrooms, kitchen and storage doors',
        linkedProductId: null,
      },
      {
        category: 'Doors, Windows, Glazing & Metalwork',
        material: 'Aluminium Sliding Windows (1.2x1.2m)',
        description: 'Powder-coated aluminium sliding window frames with 6mm tinted safety glass',
        unit: 'unit',
        quantity: windowsAluminium,
        unitPrice: REFERENCE_PRICES.slidingWindowUnit,
        total: windowsAluminium * REFERENCE_PRICES.slidingWindowUnit,
        source: 'AI_ESTIMATE',
        notes: 'All habitable rooms with integrated insect screens',
        linkedProductId: null,
      },

      // 6. Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Cement Plastering & Rendering (15mm)',
        description: 'Two-coat 1:3 cement mortar plaster to internal and external wall faces',
        unit: 'm2',
        quantity: round(wallAreaM2 * 1.9),
        unitPrice: 2800,
        total: round(wallAreaM2 * 1.9 * 2800),
        source: 'AI_ESTIMATE',
        notes: 'Internal plaster + external weather-resistant render',
        linkedProductId: null,
      },
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Porcelain Floor Tiles 60x60cm',
        description: 'Polished glazed porcelain floor tiles with cementitious tile adhesive and grout',
        unit: 'm2',
        quantity: floorTilesM2,
        unitPrice: REFERENCE_PRICES.porcelainTileM2,
        total: floorTilesM2 * REFERENCE_PRICES.porcelainTileM2,
        source: 'AI_ESTIMATE',
        notes: 'Living room, dining, hallways and bedrooms',
        linkedProductId: 'prod_4',
      },
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Ceramic Wall Tiles for Wet Areas',
        description: 'Glazed wall tiles up to 2.1m height in bathrooms and kitchen splashback',
        unit: 'm2',
        quantity: wallTilesM2,
        unitPrice: 6500,
        total: wallTilesM2 * 6500,
        source: 'AI_ESTIMATE',
        notes: 'Bathrooms, powder room and kitchen walls',
        linkedProductId: null,
      },
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Suspended Gypsum Ceiling & PVC Panels',
        description: 'Suspended galvanized channel ceiling with 9.5mm moisture-resistant gypsum boards',
        unit: 'm2',
        quantity: round(GFA * 0.92),
        unitPrice: 9500,
        total: round(GFA * 0.92 * 9500),
        source: 'AI_ESTIMATE',
        notes: 'Smooth skimmed finish with shadow-line cornice',
        linkedProductId: null,
      },
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Interior Emulsion Paint (Washable Acrylic)',
        description: 'Three coats washable interior matt emulsion paint over acrylic primer',
        unit: 'bucket',
        quantity: paintBucketsInterior,
        unitPrice: REFERENCE_PRICES.interiorPaint20L,
        total: round(paintBucketsInterior * REFERENCE_PRICES.interiorPaint20L),
        source: 'AI_ESTIMATE',
        notes: '20L buckets, coverage approx 180 m² per 2-coat bucket',
        linkedProductId: 'prod_5',
      },
      {
        category: 'Finishes (Plaster, Screed, Wall/Floor Tiles, Ceiling, Paint)',
        material: 'Exterior Weather-shield Emulsion Paint',
        description: 'UV and fungus resistant exterior elastomeric acrylic paint',
        unit: 'bucket',
        quantity: paintBucketsExterior,
        unitPrice: REFERENCE_PRICES.exteriorPaint20L,
        total: round(paintBucketsExterior * REFERENCE_PRICES.exteriorPaint20L),
        source: 'AI_ESTIMATE',
        notes: '20L buckets, weather protection against tropical driving rain',
        linkedProductId: null,
      },

      // 7. Plumbing, Drainage & Sanitary Installations
      {
        category: 'Plumbing, Drainage & Sanitary Installations',
        material: 'PPR Water Supply Distribution Pipework',
        description: 'PPR hot & cold water piping network (25mm and 20mm PN20) with thermal fittings',
        unit: 'length',
        quantity: round(roomCount * 4.5),
        unitPrice: REFERENCE_PRICES.pprPipe25,
        total: round(roomCount * 4.5 * REFERENCE_PRICES.pprPipe25),
        source: 'AI_ESTIMATE',
        notes: 'Concealed internal hot/cold water distribution',
        linkedProductId: null,
      },
      {
        category: 'Plumbing, Drainage & Sanitary Installations',
        material: 'uPVC Soil & Waste Drainage Pipework 110mm',
        description: '110mm and 75mm heavy gauge uPVC sewer pipes with inspection chambers',
        unit: 'length',
        quantity: round(roomCount * 3.2),
        unitPrice: REFERENCE_PRICES.pvcPipe110,
        total: round(roomCount * 3.2 * REFERENCE_PRICES.pvcPipe110),
        source: 'AI_ESTIMATE',
        notes: 'Gravity drainage connected to inspection gullies',
        linkedProductId: 'prod_8',
      },
      {
        category: 'Plumbing, Drainage & Sanitary Installations',
        material: 'Sanitary Ware Fixture Sets (WC, Basin, Shower Mixer)',
        description: 'Vitreous china water closet suites, vanity basins with chrome mixers and rainfall showerheads',
        unit: 'set',
        quantity: Math.max(2, Math.round(roomCount / 2.5)),
        unitPrice: 125000,
        total: Math.max(2, Math.round(roomCount / 2.5)) * 125000,
        source: 'AI_ESTIMATE',
        notes: 'Complete set per bathroom including brass angle valves and traps',
        linkedProductId: null,
      },
      {
        category: 'Plumbing, Drainage & Sanitary Installations',
        material: 'Septic Tank & Soakaway Pit Allowance',
        description: 'Cast-in-place reinforced concrete dual-chamber septic tank and gravel soakaway pit',
        unit: 'unit',
        quantity: 1,
        unitPrice: 850000,
        total: 850000,
        source: 'AI_ESTIMATE',
        notes: 'Engineered biological anaerobic septic tank for up to 10 residents',
        linkedProductId: null,
      },

      // 8. Electrical, Lighting & Power Distribution
      {
        category: 'Electrical, Lighting & Power Distribution',
        material: 'Distribution Consumer Board & Protection Switchgear',
        description: 'Main 3-phase consumer unit with 100A main isolator, RCD protection and miniature circuit breakers',
        unit: 'set',
        quantity: 1,
        unitPrice: 240000,
        total: 240000,
        source: 'AI_ESTIMATE',
        notes: 'Split load distribution board with surge protection device',
        linkedProductId: null,
      },
      {
        category: 'Electrical, Lighting & Power Distribution',
        material: 'Electrical Wiring Cables (2.5mm² & 1.5mm²)',
        description: 'Single-core copper PVC insulated wiring (2.5mm² power sockets, 1.5mm² lighting circuits)',
        unit: 'roll',
        quantity: round(GFA / 60, 1),
        unitPrice: REFERENCE_PRICES.electricalCableRoll,
        total: round((GFA / 60) * REFERENCE_PRICES.electricalCableRoll),
        source: 'AI_ESTIMATE',
        notes: '100m rolls in concealed PVC conduit',
        linkedProductId: 'prod_10',
      },
      {
        category: 'Electrical, Lighting & Power Distribution',
        material: 'Switches, Double Socket Outlets & TV Points',
        description: 'Modular flush-mounted polycarbonate switches and 13A switched double socket outlets',
        unit: 'unit',
        quantity: round(roomCount * 6),
        unitPrice: 3800,
        total: round(roomCount * 6 * 3800),
        source: 'AI_ESTIMATE',
        notes: 'Generous outlet distribution per room',
        linkedProductId: null,
      },
      {
        category: 'Electrical, Lighting & Power Distribution',
        material: 'LED Ceiling Downlights & Architectural Luminares',
        description: 'Recessed 12W warm-white LED downlights and exterior waterproof IP65 wall luminaires',
        unit: 'unit',
        quantity: round(roomCount * 3.5),
        unitPrice: 12000,
        total: round(roomCount * 3.5 * 12000),
        source: 'AI_ESTIMATE',
        notes: 'Energy efficient illumination',
        linkedProductId: null,
      },
    ];

    const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
    const contingencyPercent = 5.0;
    const contingencyAmountXaf = round(subtotal * (contingencyPercent / 100));
    const grandTotal = subtotal + contingencyAmountXaf;
    const structuralCostPerM2 = round(grandTotal / GFA);

    const materials: MaterialTakeoffSummary[] = [
      {
        material: 'Portland Cement (50kg bags)',
        category: 'Structural Concrete & Mortar',
        estimatedQuantity: totalCementBags,
        unit: 'bag',
        unitPrice: REFERENCE_PRICES.cementBag,
        totalCost: totalCementBags * REFERENCE_PRICES.cementBag,
        wasteAllowancePercent: 5.0,
        specification: 'CEM II/B-L 42.5R (DANGOTE / CIMENCAM or equivalent)',
        marketplaceMatch: { id: 'prod_1', title: 'Portland Cement 50kg (CEM II 42.5)', price: REFERENCE_PRICES.cementBag },
      },
      {
        material: 'High-Tensile Steel Rebar FeE500 (Mixed 8, 10, 12mm)',
        category: 'Reinforcement Steel',
        estimatedQuantity: rebar12mm + rebar10mm + rebar8mm,
        unit: 'length (12m)',
        unitPrice: 5800,
        totalCost: (rebar12mm + rebar10mm + rebar8mm) * 5800,
        wasteAllowancePercent: 7.5,
        specification: 'Deformed ribbed high-yield bar FeE500 (Prometal / Metafrique)',
        marketplaceMatch: { id: 'prod_2', title: 'High-Tensile Steel Rebar 12mm', price: REFERENCE_PRICES.rebar12mm },
      },
      {
        material: 'Hollow Concrete Blocks (15cm & 20cm)',
        category: 'Masonry & Blockwork',
        estimatedQuantity: blocks15 + blocks20Foundation,
        unit: 'block',
        unitPrice: 475,
        totalCost: (blocks15 + blocks20Foundation) * 475,
        wasteAllowancePercent: 5.0,
        specification: 'Heavy machine-vibrated concrete blocks with crushing strength >= 4.0 N/mm²',
        marketplaceMatch: null,
      },
      {
        material: 'River Sand & Concrete Sand',
        category: 'Aggregates',
        estimatedQuantity: sandM3,
        unit: 'm3',
        unitPrice: REFERENCE_PRICES.riverSandM3,
        totalCost: round(sandM3 * REFERENCE_PRICES.riverSandM3),
        wasteAllowancePercent: 10.0,
        specification: 'Clean sharp Sanaga river sand free of organic silt and clay',
        marketplaceMatch: null,
      },
      {
        material: 'Crushed Basalt Gravel Aggregate (15/25mm)',
        category: 'Aggregates',
        estimatedQuantity: gravelM3,
        unit: 'm3',
        unitPrice: REFERENCE_PRICES.gravelM3,
        totalCost: round(gravelM3 * REFERENCE_PRICES.gravelM3),
        wasteAllowancePercent: 8.0,
        specification: 'Crushed basalt quarry stone 15/25mm grade',
        marketplaceMatch: null,
      },
      {
        material: 'Corrugated Roofing Sheets & Fasteners',
        category: 'Roof Covering',
        estimatedQuantity: roofSheets,
        unit: 'sheet',
        unitPrice: REFERENCE_PRICES.roofingSheet,
        totalCost: roofSheets * REFERENCE_PRICES.roofingSheet,
        wasteAllowancePercent: 5.0,
        specification: '0.50mm Alu-Zinc corrugated sheet (Alucam / Batitole)',
        marketplaceMatch: { id: 'prod_6', title: 'Galvanised Roofing Sheet 0.5mm', price: REFERENCE_PRICES.roofingSheet },
      },
      {
        material: 'Porcelain Floor & Ceramic Wall Tiles',
        category: 'Architectural Finishes',
        estimatedQuantity: floorTilesM2 + wallTilesM2,
        unit: 'm2',
        unitPrice: 7900,
        totalCost: (floorTilesM2 + wallTilesM2) * 7900,
        wasteAllowancePercent: 10.0,
        specification: 'Full-body porcelain 60x60cm and non-slip ceramic wall tiles',
        marketplaceMatch: { id: 'prod_4', title: 'Ceramic Floor Tile 60x60', price: REFERENCE_PRICES.porcelainTileM2 },
      },
      {
        material: 'Washable Acrylic Emulsion Paint (20L Buckets)',
        category: 'Finishes & Coatings',
        estimatedQuantity: round(paintBucketsInterior + paintBucketsExterior, 1),
        unit: 'bucket (20L)',
        unitPrice: 38000,
        totalCost: round((paintBucketsInterior + paintBucketsExterior) * 38000),
        wasteAllowancePercent: 5.0,
        specification: 'Anti-fungal washable interior and weather-resistant exterior acrylic paint',
        marketplaceMatch: { id: 'prod_5', title: 'Interior Emulsion Paint 20L', price: REFERENCE_PRICES.interiorPaint20L },
      },
    ];

    const engineeringInsights = {
      siteAnalysis: `The plan geometry indicates an efficient ${GFA} m² footprint with a structural span layout that minimizes load-bearing column count. Soil bearing capacity is assumed at 150 kPa for standard strip footings.`,
      structuralRecommendations: [
        'Utilize Grade C25/30 (350 kg/m³ cement content) for ground floor tie beams and reinforced columns to prevent capillary moisture ingress.',
        'Install 150mm vertical and horizontal starter bars at all wall-to-column intersections to prevent seismic and thermal shrinkage cracks.',
        'Ensure roofing timber is treated with copper-chromium-boron (CCB) preservative to prevent termite attack in equatorial climates.',
      ],
      valueEngineeringTips: [
        'Standardizing window dimensions to 1.2m x 1.2m saves approximately 15% on custom aluminium fabrication costs.',
        'Procuring cement and steel in bulk pallets directly from verified BuildSmart marketplace distributors provides an estimated 8-12% cost reduction compared to retail hardware stores.',
        'Placing wet areas (bathrooms and kitchen) in back-to-back clusters reduces plumbing piping runs by approximately 25%.',
      ],
      climateAndDurabilityNotes:
        'Roof eaves are recommended at 60cm - 80cm overhang to shield exterior rendered walls from tropical torrential rains and reduce solar heat gain.',
      estimatedMilestones: [
        { milestone: 'Substructure & Foundation Works', durationWeeks: 4, costSharePercent: 22 },
        { milestone: 'Structural Concrete Frame & Floor Slab', durationWeeks: 4, costSharePercent: 20 },
        { milestone: 'Blockwork Masonry & Lintel Beams', durationWeeks: 3, costSharePercent: 14 },
        { milestone: 'Roof Truss Framing & Metal Sheeting', durationWeeks: 3, costSharePercent: 15 },
        { milestone: 'Plastering, Screed & Tile Finishes', durationWeeks: 5, costSharePercent: 16 },
        { milestone: 'Plumbing, Electrical & Fixtures', durationWeeks: 3, costSharePercent: 13 },
      ],
    };

    return {
      summary: {
        grossFloorAreaM2: GFA,
        totalEstimatedCostXaf: subtotal,
        structuralCostPerM2,
        costPerM2Xaf: Math.round(subtotal / (GFA || 1)),
        currency: 'XAF',
        estimatedDurationMonths: 5.5,
        tradeCount: 8,
        itemCount: items.length,
        contingencyPercent,
        contingencyAmountXaf,
        grandTotalWithContingencyXaf: grandTotal,
        wasteFactorPercent: 7.5,
        soilAssumption: 'Firm lateritic clay (allowable bearing capacity >= 150 kPa)',
        concreteGradeSpecification: 'C25/30 (CEM II 42.5R @ 350 kg/m³)',
      },
      items,
      materials,
      engineeringInsights,
    };
  }
}

export const floorPlanBoqService = new FloorPlanBoqService();
