import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callGemini, type GeminiMessage } from '@/Backend/lib/gemini';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

const ROLE = 'ARCHITECT';

const BASE_SYSTEM = `You are BuildSmart AI, an embedded architectural and construction assistant for professional architects in Cameroon and the wider West/Central African region.

Scope you must stay inside:
- Architectural design, concept development, spatial planning, design reviews.
- Building materials, construction methods, structural systems, waterproofing, foundation design, and durability in tropical/humid/saline climates.
- National / international building codes, permits, professional standards, and site/verification requirements (provide general guidance and always advise the architect to confirm with local authorities and a licensed engineer).
- Cost estimation, BOQ structure, procurement, and value engineering.
- Project planning, construction sequencing, site logistics, contractor and consultant coordination.
- Sustainability, passive cooling, ventilation, daylighting, rainwater harvesting, solar readiness, and locally available materials.
- Client briefs, feasibility, and construction requirements.

Rules:
- If the question is outside architectural/construction scope, politely redirect back to architecture, construction, design, or building-project management.
- Never fabricate exact regulatory citations; frame them as recommendations to confirm with local authorities.
- Prefer concise, practical, bullet-style answers. Use simple headings when useful.
- Where relevant to Cameroon, mention local realities: climate, rainfall, terrain, availability of materials, cost of importing goods, and local building culture.
- Treat the conversation as a support tool for a professional architect, not as legal, structural-engineering, or final code approval.

Always answer in the language used by the user.`;

const MODE_PROMPTS: Record<string, string> = {
  architecture: `The architect is working on ARCHITECTURAL DESIGN. Focus on concept, spatial planning, circulation, massing, style, daylight, ventilation, and design rationale.`,
  construction: `The architect is working on CONSTRUCTION & BUILDING REQUIREMENTS. Focus on constructability, foundations, superstructure, roofing, waterproofing, finishes, site work, and sequencing.`,
  materials: `The architect is working on MATERIALS & BOQ. Focus on material selection, local vs imported materials, sustainability, durability, unit costs in XAF/m² where useful, and approximate quantities.`,
  codes: `The architect is working on CODES, PERMITS & STANDARDS. Focus on permitting workflow, documentation, structural/safety considerations, and professional responsibilities.`,
  project: `The architect is working on PROJECT MANAGEMENT. Focus on program, phases, procurement, contractor coordination, risk, and construction timeline.`,
};

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(6000),
      }),
    )
    .min(1)
    .max(30),
  mode: z.string().optional(),
  project: z.string().optional(),
});

const max = (v: any, n: number) => (v === undefined ? v : String(v).slice(0, n));

const MODE_FALLBACK: Record<string, { title: string; points: string[] }> = {
  architecture: {
    title: 'Space & architectural guidance',
    points: [
      'Confirm the site dimensions, orientation, setback rules, and access before massing.',
      'Optimize cross-ventilation by placing openings on opposing façades and using high-level windows for warm-air escape.',
      'Use deep roof overhangs and shaded verandas to protect walls from tropical rains and direct sun.',
      'Keep service cores (kitchen, bathrooms, storage) compact and stack them vertically where possible.',
      'Design for future solar and rainwater-ready infrastructure from the outset.',
    ],
  },
  construction: {
    title: 'Construction & building requirements',
    points: [
      'Start with a proper site survey, soil test, and setting-out before excavation.',
      'Specify compacted laterite/gravel fill, damp-proofing, and a reinforced strip or raft foundation suited to the soil.',
      'Use strong, well-treated timber or reinforced concrete formwork and plan curing time for concrete.',
      'Install a robust roof drainage system with gutters and splash blocks; flash all penetrations.',
      'Document a construction sequencing plan and hold milestones: substructure → frame → envelope → MEP → finishes.',
    ],
  },
  materials: {
    title: 'Material & BOQ guidance',
    points: [
      'Prefer locally sourced cement, sand, and crushed stone to reduce cost and lead time.',
      'For walls in humid climates, consider hollow blocks plus regular damp-proof coursing and weather-resistant renders.',
      'Use a lightweight metal or treated timber roof system with reflective insulation.',
      'Specify floor tiles rated for wet areas; break edges with proper expansion joints.',
      'Round quantities up slightly for wastage and always cross-check the BOQ against site drawings.',
    ],
  },
  codes: {
    title: 'Codes & permit guidance',
    points: [
      'Prepare architectural drawings, structural notes, site plan, ownership documents, and a cost estimate for the permit file.',
      'Confirm the required approvals with your local municipal / departmental authority before submission.',
      'Engage a licensed structural engineer for any complex or multi-storey project.',
      'Keep a revision log and signed approval records for every drawing issue.',
      'Remember that this is general guidance, not a substitute for local regulation or engineering review.',
    ],
  },
  project: {
    title: 'Project management guidance',
    points: [
      'Break the project into phases with clear gates: brief → design → permits → procurement → construction → handover.',
      'Set a realistic program with float for weather, material delays, and client decisions.',
      'Establish a procurement plan early for long-lead imported items.',
      'Use a simple RFI / variation workflow so scope changes are tracked and priced.',
      'Schedule site visits and record daily or weekly progress to keep the contractor accountable.',
    ],
  },
  sustainability: {
    title: 'Sustainable & climate-responsive guidance',
    points: [
      'Orient the building to reduce east/west heat gain and capture prevailing breezes.',
      'Use shading devices, high thermal mass, and light-colored roofs or reflective insulation.',
      'Collect and store rainwater for landscaping and non-potable uses; plan greywater reuse if feasible.',
      'Prioritize passive ventilation and ceiling fans before mechanical cooling.',
      'Choose durable, low-maintenance materials that perform well in heat, humidity, and heavy rain.',
    ],
  },
};

// Offline/local assistant used when the sandbox or deployment has no outbound
// internet so the architect still gets useful, data-backed guidance. In a
// normal deployed environment with outbound access, live Gemini responses are
// returned instead.
async function offlineAssistant(lastMessage: string, mode?: string) {
  const m = mode && MODE_FALLBACK[mode] ? mode : 'architecture';
  const guidance = MODE_FALLBACK[m];

  const allProducts: any[] = await dbClient.product.findMany();
  const categoryMap: Record<string, string[]> = {
    materials: ['cement', 'steel', 'tile', 'brick', 'block', 'paint', 'roof', 'wood'],
    construction: ['cement', 'steel', 'block', 'sand', 'gravel'],
    architecture: ['tile', 'wood', 'glass', 'paint'],
    sustainability: ['solar', 'insulation', 'roof', 'green', 'energy'],
    project: [],
    codes: [],
  };

  const keywords = categoryMap[m] ?? [];
  const matches = allProducts.filter((p) => {
    const text = `${p.name ?? ''} ${p.category ?? ''} ${p.tags ?? ''} ${p.description ?? ''}`.toLowerCase();
    return !keywords.length || keywords.some((k) => text.includes(k));
  });
  const top = (matches.length ? matches : allProducts).slice(0, 4);

  const fx = (n: any) => Number(n ?? 0).toLocaleString();
  const productList = top.length
    ? top
        .map((p) => `- **${p.name}** (${p.category ?? 'Material'}) — approx. ${fx(p.price)} ${p.currency ?? 'XAF'}/${p.unit ?? 'unit'}${p.stock != null ? ` · ${p.stock} in stock` : ''}`)
        .join('\n')
    : '- No local marketplace matches loaded for this topic yet.';

  const content = `### ${guidance.title}

**Key considerations:**

${guidance.points.map((p) => `- ${p}`).join('\n')}

**Products available in the BuildSmart marketplace:**

${productList}

---
*This is the offline BuildSmart assistant. Live Gemini responses are used automatically when the server has outbound internet access.*

*Need to confirm any structural or regulatory decision with a licensed engineer and the relevant local authority.*`;

  return { content, model: 'buildsmart-offline', offline: true };
}

export async function POST(req: NextRequest) {
  let parsed: ReturnType<typeof RequestSchema.safeParse> | null = null;
  let user: { id: string; name: string; email: string; role: string } | null = null;

  try {
    user = await resolveUser(ROLE);
    parsed = RequestSchema.safeParse(await req.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: send a non-empty conversation history' },
        { status: 400 },
      );
    }

    const { messages, mode, project } = parsed.data;

    const modeBlock = mode && MODE_PROMPTS[mode] ? `\n\n${MODE_PROMPTS[mode]}` : '';
    const projectBlock = project
      ? `\n\nActive project context shared by the architect: ${max(project, 600)}`
      : '';
    const system = `${BASE_SYSTEM}${modeBlock}${projectBlock}

Session user: ${user.name} (role ${user.role}). Keep answers relevant to their professional work.`;

    const result = await callGemini(system, messages as GeminiMessage[]);

    return NextResponse.json({
      success: true,
      content: result.text,
      model: result.model,
      usage: result.usage ?? null,
      mode: mode ?? 'architecture',
      offline: false,
    });
  } catch (err: any) {
    // GEMINI_API_KEY missing is a configuration error, not a network issue.
    if (err?.status === 503) {
      console.error('[ai/gemini]', err?.message ?? err);
      return NextResponse.json(
        { error: 'Gemini is not configured on the server. Please set GEMINI_API_KEY.' },
        { status: 503 },
      );
    }

    console.error('[ai/gemini]', err?.message ?? err);

    // Fall back to the local assistant when the network is unavailable (common
    // in sandboxed previews where outbound HTTPS is blocked).
    try {
      const last =
        parsed?.success && parsed.data.messages.length
          ? parsed.data.messages[parsed.data.messages.length - 1].content
          : 'architecture guidance';
      const fallback = await offlineAssistant(
        last,
        parsed?.success ? parsed.data.mode : undefined,
      );

      return NextResponse.json({
        success: true,
        content: fallback.content,
        model: fallback.model,
        usage: null,
        mode: parsed?.success ? parsed.data.mode : 'architecture',
        offline: fallback.offline,
      });
    } catch (fallbackErr) {
      console.error('[ai/gemini][offline]', fallbackErr);
    }

    return NextResponse.json(
      { error: 'The AI assistant is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}
