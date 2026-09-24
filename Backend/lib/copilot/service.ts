// BuildSmart AI Copilot service layer.
//
// Layered flow:
//   guard (domain classification / injection block)
//   → context builder (authorized project + architect info)
//   → controlled tools (read-only authorized BuildSmart reads)
//   → Gemini (or data-backed offline fallback)
//   → response validation / sanitization

import { callGemini, type GeminiMessage } from '../gemini';
import {
  SYSTEM_PROMPT,
  MODE_GUIDANCE,
  GREETING_RESPONSES,
  FALLBACK_BY_MODE,
} from './prompts';
import { guardRequest, type DomainCategory } from './guard';
import { buildAuthorizedContext, type AuthorizedContext } from './context';
import { runToolsForRequest, type ToolResult } from './tools';
import { validateBOQDraft, validateSanitizedProducts } from './validator';

export type CopilotRequest = {
  messages: GeminiMessage[];
  mode?: string;
  projectId?: string | null;
  recognizeTools?: boolean;
};

export type CopilotResponse = {
  content: string;
  category: DomainCategory;
  mode: string;
  model: string;
  offline: boolean;
  blocked: boolean;
  blockedReason?: 'OFF_TOPIC' | 'UNSAFE_TECHNICAL' | null;
  tools: ToolResult[];
  context: AuthorizedContext;
};

const IDENTITY = 'BuildSmart AI Copilot';

const CATEGORY_BY_MODE: Record<string, DomainCategory> = {
  architecture: 'ARCHITECTURE',
  construction: 'CONSTRUCTION',
  materials: 'MATERIALS',
  estimation: 'ESTIMATION',
  boq: 'BOQ',
  project: 'PROJECT',
  builds: 'BUILDSMART',
  general: 'ARCHITECTURE',
};

function categoryForMode(mode: string): DomainCategory {
  return CATEGORY_BY_MODE[mode] ?? 'ARCHITECTURE';
}

function decorateResponse(content: string, mode: string): string {
  const highRisk = ['estimation', 'boq', 'construction', 'materials'].includes(mode);
  const lower = content.toLowerCase();
  const alreadyLabeled = lower.includes('preliminary') && (lower.includes('verify') || lower.includes('profession') || lower.includes('qualified'));
  if (!highRisk || alreadyLabeled) return content;
  return `${content}\n\n---\n*AI-generated preliminary estimate/guidance — verify quantities, costs and high-risk technical decisions with a qualified engineer or quantity surveyor.*`;
}

function greetingFor(text: string): string | null {
  const t = text.toLowerCase().trim();
  return GREETING_RESPONSES[t] ?? null;
}

function formatProducts(data: any): string {
  const products = data?.products ?? [];
  if (!products.length) return '- No authorized marketplace material matches were available.';
  return products
    .map(
      (p: any) =>
        `- **${p.name}** (${p.category ?? 'Material'}) — approx. ${Number(p.price ?? 0).toLocaleString()} ${p.currency ?? 'XAF'}/${p.unit ?? 'unit'}${p.stock != null ? ` · ${p.stock} in stock` : ''}`,
    )
    .join('\n');
}

function buildOfflineResponse(input: string, mode: string, tools: ToolResult[], context: AuthorizedContext): { content: string; model: string } {
  const f = FALLBACK_BY_MODE[mode] ?? FALLBACK_BY_MODE.architecture;

  const productTool = tools.find((t) => t.tool === 'searchMarketplaceMaterials');
  const boqTool = tools.find((t) => t.tool === 'createBOQDraft');
  const designTool = tools.find((t) => t.tool === 'getProjectDesign');

  // The offline path is only used when Gemini genuinely cannot be reached. It
  // is still contextual: it reflects the architect's exact question, the
  // authorized project, and any relevant project/marketplace data.
  const projectBlock = context.project
    ? [
        '',
        '**Authorized project context:**',
        `- ${context.project.name} (${context.project.projectType ?? 'Project'})`,
        `- Location: ${context.project.location || 'Not specified'} · Status: ${context.project.status}`,
        context.project.siteArea ? `- Site area: approx. ${context.project.siteArea}m²` : '',
        context.project.budget ? `- Budget reference: approx. ${context.project.budget.toLocaleString()} XAF` : '',
        context.project.requirements ? `- Requirements: ${context.project.requirements}` : '',
      ].filter(Boolean).join('\n')
    : '';

  let extras = '';
  if (boqTool) {
    const v = validateBOQDraft(boqTool.data);
    if (v.ok) {
      const rows = v.value.sections;
      const table = rows
        .map((r: any) => `| ${r.category} | ${r.material} | ${r.unit} | ${Number(r.estimatedUnitCost).toLocaleString()} XAF |`)
        .join('\n');
      extras = `\n\n### Preliminary BOQ skeleton\n\n| Category | Material | Unit | Ref Unit Cost |\n| --- | --- | --- | --- |\n${table}\n\n_${v.value.disclaimer}_`;
    }
  } else if (productTool) {
    const v = validateSanitizedProducts(productTool.data);
    if (v.ok) {
      extras = `\n\n**Authorized marketplace materials:**\n\n${formatProducts({ products: v.value.products })}`;
    }
  }

  if (designTool && Array.isArray(designTool.data?.plans) && designTool.data.plans.length) {
    const plans = designTool.data.plans
      .map((p: any) => `- **${p.name}** (${p.kind ?? 'Plan'} · v${p.version ?? 1} · ${p.status ?? 'DRAFT'})`) 
      .join('\n');
    extras += `\n\n**Floor-plan records in the active project:**\n\n${plans}`;
  }

  const intro = `### ${f.title}\n\n**Your question:** ${input.trim()}\n\n${f.points.map((p: string) => `- ${p}`).join('\n')}${projectBlock}${extras}`;

  const content = `${intro}\n\n---\n*The live Gemini service is currently unreachable from this server, so I answered with the BuildSmart AI offline copilot. As soon as the server has outbound internet access, live Gemini answers are used automatically.*\n\n*For structural, geotechnical, fire/safety or final-code decisions, consult the appropriate qualified professional.*`;

  return { content, model: 'buildsmart-copilot-offline' };
}

export async function generateCopilotResponse(req: CopilotRequest, user: { id: string; name: string; role: string }): Promise<CopilotResponse> {
  const last = req.messages.length ? req.messages[req.messages.length - 1].content : '';
  const mode = req.mode ?? 'general';

  // ---- Level 1: application-domain guard ----
  const guard = guardRequest(last);
  if (!guard.pass) {
    return {
      content: guard.response,
      category: guard.category,
      mode: guard.mode,
      model: 'buildsmart-copilot-guard',
      offline: true,
      blocked: true,
      blockedReason: guard.category === 'UNSAFE_TECHNICAL' ? 'UNSAFE_TECHNICAL' : 'OFF_TOPIC',
      tools: [],
      context: await buildAuthorizedContext(user, req.projectId),
    };
  }

  const effectiveMode = guard.mode === 'general' ? mode : guard.mode;

  // ---- Authorized context + controlled tools ----
  const context = await buildAuthorizedContext(user, req.projectId);
  const tools = req.recognizeTools === false ? [] : await runToolsForRequest(context, last, effectiveMode);

  // ---- Natural greeting / acknowledgement ----
  const greeting = greetingFor(last);
  if (greeting && req.messages.length === 1) {
    return {
      content: greeting,
      category: categoryForMode(effectiveMode),
      mode: effectiveMode,
      model: 'buildsmart-copilot',
      offline: true,
      blocked: false,
      blockedReason: null,
      tools,
      context,
    };
  }

  // ---- Build the model prompt ----
  const modeBlock = MODE_GUIDANCE[effectiveMode] ?? MODE_GUIDANCE.general;
  const contextBlock = contextToPromptSnippet(context);
  const toolBlock = tools
    .map((t) => `[tool:${t.tool}] ${t.summary}`)
    .join('\n');

  const system = `${SYSTEM_PROMPT}

**Active focus mode:** ${effectiveMode}
${modeBlock}

${contextBlock}

**Authorized tool results for this request:**
${toolBlock || '(none)'}

Session identity: ${IDENTITY}.`;

  // ---- Level 2: model call with data-backed fallback ----
  try {
    const result = await callGemini(system, req.messages as GeminiMessage[]);
    return {
      content: decorateResponse(result.text, effectiveMode),
      category: categoryForMode(effectiveMode),
      mode: effectiveMode,
      model: result.model,
      offline: false,
      blocked: false,
      blockedReason: null,
      tools,
      context,
    };
  } catch (err: any) {
    // Missing key is a configuration error -> surface it.
    if (err?.status === 503) throw err;

    // Only fall back to the offline copilot when the network path is genuinely
    // unavailable. API credential/model errors (400/401/403/404/429...) must be
    // surfaced so they are not hidden behind a canned response.
    const networkFailure = err?.isNetworkError === true || /fetch failed|network error|unable to reach|AbortError/.test(String(err?.message ?? ''));
    if (!networkFailure) throw err;

    console.error('[copilot][offline]', err?.message ?? err);
    const offline = buildOfflineResponse(last, effectiveMode, tools, context);
    return {
      content: offline.content,
      category: categoryForMode(effectiveMode),
      mode: effectiveMode,
      model: offline.model,
      offline: true,
      blocked: false,
      blockedReason: null,
      tools,
      context,
    };
  }
}

function contextToPromptSnippet(ctx: AuthorizedContext): string {
  if (ctx.project) {
    const p = ctx.project;
    return [
      '**Authorized project context:**',
      `- Project: ${p.name}`,
      `- Type: ${p.projectType ?? 'Not specified'} · Status: ${p.status} · Progress: ${p.progress}%`,
      p.floors ? `- Floors: ${p.floors}` : '',
      p.rooms ? `- Rooms: ${p.rooms}` : '',
      p.siteArea ? `- Area: approx. ${p.siteArea}m²` : '',
      p.budget ? `- Budget: approx. ${p.budget.toLocaleString()} XAF` : '',
      p.location ? `- Location: ${p.location}` : '',
      p.requirements ? `- Requirements: ${p.requirements}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (ctx.availableProjects.length) {
    return `**Authorized projects:** ${ctx.availableProjects.map((p) => p.name).join(', ')} (none selected as active focus).`;
  }
  return 'No authorized project context is currently attached.';
}
