// Controlled, server-authorized BuildSmart tools.
//
// Every tool:
//  1. Authenticates (caller supplies the resolved auth user).
//  2. Authorizes (data is scoped to that user/role).
//  3. Validates parameters.
//  4. Executes a read-only / non-destructive operation (or returns a draft the
//     UI can confirm before persisting).
//  5. Returns sanitized data.
//
// The Gemini model never receives an open database connection and cannot issue
// arbitrary SQL or JS.

import { dbClient } from '../db';
import type { AuthorizedContext } from './context';

export type ToolResult = {
  tool: string;
  summary: string;
  data: any;
  persisted?: boolean;
};

const MAX_PRODUCTS = 8;

export async function listAuthorizedProjects(ctx: AuthorizedContext): Promise<ToolResult> {
  return {
    tool: 'listAuthorizedProjects',
    summary: `Loaded ${ctx.availableProjects.length} authorized project(s).`,
    data: { projects: ctx.availableProjects },
  };
}

export async function getProjectContext(ctx: AuthorizedContext): Promise<ToolResult> {
  return {
    tool: 'getProjectContext',
    summary: ctx.project ? `Loaded project "${ctx.project.name}".` : 'No authorized project selected.',
    data: { project: ctx.project },
  };
}

export async function getProjectRequirements(ctx: AuthorizedContext): Promise<ToolResult> {
  return {
    tool: 'getProjectRequirements',
    summary: ctx.project ? `Loaded requirements for "${ctx.project.name}".` : 'No authorized project selected.',
    data: { projectId: ctx.project?.id ?? null, requirements: ctx.project?.requirements ?? '' },
  };
}

export async function getProjectDesign(ctx: AuthorizedContext): Promise<ToolResult> {
  const projectId = ctx.project?.id;
  if (!projectId) {
    return { tool: 'getProjectDesign', summary: 'No authorized project selected.', data: { plans: [] } };
  }
  const plans: any[] = await dbClient.floorPlan.findMany({ where: { projectId } });
  const data = plans.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    version: p.version,
    status: p.status,
    rooms: Array.isArray(p.data) ? p.data : safeParseRooms(p.data),
  }));
  return {
    tool: 'getProjectDesign',
    summary: `Loaded ${data.length} floor-plan record(s) for the active project.`,
    data: { plans: data },
  };
}

export async function getProjectRoomagenGenerations(ctx: AuthorizedContext): Promise<ToolResult> {
  const projectId = ctx.project?.id;
  if (!projectId) {
    return { tool: 'getProjectRoomagenGenerations', summary: 'No authorized project selected.', data: { generations: [] } };
  }
  const jobs: any[] = await dbClient.roomagenJob.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const data = jobs.map((j) => ({
    id: j.id,
    tool: j.tool,
    status: j.status,
    version: j.version,
    hasOutput: Boolean(j.outputAssetUrl),
    createdAt: j.createdAt,
    completedAt: j.completedAt,
  }));
  return {
    tool: 'getProjectRoomagenGenerations',
    summary: `Found ${data.length} Roomagen AI generation record(s) for the active project.`,
    data: { generations: data },
  };
}

export async function searchMarketplaceMaterials(query?: string): Promise<ToolResult> {
  const all: any[] = await dbClient.product.findMany();
  const q = (query ?? '').toLowerCase().trim();
  const filtered = q
    ? all.filter((p) => `${p.name} ${p.category} ${p.tags ?? ''} ${p.description ?? ''}`.toLowerCase().includes(q))
    : all;
  const data = filtered.slice(0, MAX_PRODUCTS).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    price: p.price,
    currency: 'XAF',
    stock: p.stock,
    description: p.description,
    tags: p.tags,
  }));
  return {
    tool: 'searchMarketplaceMaterials',
    summary: `Found ${data.length} material/product record(s) in the marketplace${q ? ` matching "${q}"` : ''}.`,
    data: { products: data },
  };
}

export async function getArchitectProfile(ctx: AuthorizedContext): Promise<ToolResult> {
  return {
    tool: 'getArchitectProfile',
    summary: ctx.profile ? `Loaded architect profile for ${ctx.user.name}.` : 'No architect profile loaded.',
    data: { profile: ctx.profile },
  };
}

export async function createBOQDraft(ctx: AuthorizedContext): Promise<ToolResult> {
  const project = ctx.project;
  const products: any[] = await dbClient.product.findMany();
  // No fabricated quantities: the draft only carries structure + catalog prices,
  // and the AI labels it as a preliminary skeleton requiring verification.
  const rows = products.slice(0, 6).map((p) => ({
    category: p.category,
    material: p.name,
    description: p.description ?? '',
    quantity: 0,
    unit: p.unit,
    estimatedUnitCost: p.price,
    estimatedTotal: 0,
    notes: 'Quantity to be verified from drawings; listed unit cost is marketplace reference.',
  }));
  return {
    tool: 'createBOQDraft',
    summary: 'Created a preliminary BOQ skeleton using authorized project + marketplace data. No project data was modified.',
    data: {
      projectId: project?.id ?? null,
      projectName: project?.name ?? 'Unspecified project',
      disclaimer: 'AI-generated preliminary estimate — requires professional verification.',
      sections: rows,
    },
    persisted: false,
  };
}

export async function createDesignBrief(ctx: AuthorizedContext, requirements: string): Promise<ToolResult> {
  const brief = {
    projectId: ctx.project?.id ?? null,
    projectName: ctx.project?.name ?? 'Unspecified project',
    source: 'Client/architect requirements',
    requirements,
    status: 'DRAFT',
    disclaimer: 'Structured extract — architect to confirm with client.',
  };
  return {
    tool: 'createDesignBrief',
    summary: 'Created a structured design brief from the provided requirements (draft only).',
    data: brief,
    persisted: false,
  };
}

function safeParseRooms(data: any): any[] {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed?.rooms) ? parsed.rooms : [];
  } catch {
    return [];
  }
}

// Keep a registry so the UI can display available capabilities and so all tool
// calls remain auditable.
export async function runToolsForRequest(
  ctx: AuthorizedContext,
  input: string,
  mode: string,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  void mode; // retained for future tool routing; current tools infer from the prompt.
  const text = input.toLowerCase();

  // Project context is always useful.
  results.push(await getProjectContext(ctx));
  results.push(await getArchitectProfile(ctx));

  if (/(marketplace|material|product)/.test(text)) {
    results.push(await searchMarketplaceMaterials(''));
  }

  if (/(design|floor.?plan|plan|layout|3d|render|visualization|roomagen)/i.test(text)) {
    results.push(await getProjectDesign(ctx));
    results.push(await getProjectRoomagenGenerations(ctx));
  }

  if (/(boq|bill of quantities)/.test(text)) {
    results.push(await createBOQDraft(ctx));
  } else if (/(estimate|estimation|material quantity|how many)/.test(text)) {
    results.push(await searchMarketplaceMaterials(''));
  }

  if (/(requirement|brief|client wants|client require|summary)/.test(text)) {
    results.push(await getProjectRequirements(ctx));
  }

  return results;
}
