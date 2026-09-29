// Shared execution path for the Copilot API. JSON and SSE transports both use
// this so persistence/auditing/rate-limit behavior is identical.

import { z } from 'zod';
import { dbClient } from '../db';
import { generateCopilotResponse } from './service';
import { checkRateLimit, recordUserHit } from './rate-limit';

export const CopilotMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(6000),
});

export const CopilotRequestSchema = z.object({
  conversationId: z.string().nullable().optional(),
  messages: z.array(CopilotMessageSchema).min(1).max(30),
  mode: z.string().max(40).optional(),
  projectId: z.string().nullable().optional(),
  recognizeTools: z.boolean().optional(),
});

export const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];

export type CopilotRunResult =
  | { ok: true; status: 200; data: any }
  | { ok: false; status: number; error: string };

export async function runCopilot(
  body: unknown,
  user: { id: string; name: string; role: string },
  started: number,
): Promise<CopilotRunResult> {
  const parsed = CopilotRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Invalid request: send a non-empty conversation history.' };
  }

  const { conversationId, messages, mode, projectId, recognizeTools } = parsed.data;

  // ---- Rate limit ----
  const rate = await checkRateLimit(user.id);
  if (!rate.allowed) {
    await dbClient.aiUsageLog
      .create({
        data: {
          userId: user.id,
          conversationId: conversationId ?? null,
          category: 'RATE_LIMITED',
          model: null,
          status: 'RATE_LIMITED',
          tokenCount: null,
          latencyMs: Date.now() - started,
          errorCategory: 'rate-limit',
        },
      })
      .catch(() => {});
    return { ok: false, status: 429, error: `Too many requests. Please try again in ${rate.retryAfterSeconds}s.` };
  }
  recordUserHit(user.id);

  // ---- Resolve / create the conversation (owner-scoped) ----
  let convo: any = null;
  if (conversationId) {
    convo = await dbClient.aiConversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.userId !== user.id) {
      return { ok: false, status: 404, error: 'Conversation not found.' };
    }
  }
  if (!convo) {
    convo = await dbClient.aiConversation.create({
      data: {
        userId: user.id,
        title: 'New conversation',
        mode: mode ?? 'architecture',
        projectId: projectId ?? null,
        status: 'ACTIVE',
        messageCount: 0,
        lastMessageAt: null,
      },
    });
  }
  if (mode && convo.mode !== mode) {
    convo = await dbClient.aiConversation.update({ where: { id: convo.id }, data: { mode } });
  }
  if (projectId && convo.projectId !== projectId) {
    convo = await dbClient.aiConversation.update({ where: { id: convo.id }, data: { projectId } });
  }

  // ---- Persist user message ----
  const userMsg = messages[messages.length - 1];
  await dbClient.aiMessage.create({
    data: {
      conversationId: convo.id,
      userId: user.id,
      role: 'user',
      content: userMsg.content,
      category: null,
      model: null,
      meta: null,
    },
  });

  // ---- Generate ----
  const response = await generateCopilotResponse(
    { messages, mode, projectId, recognizeTools },
    { id: user.id, name: user.name, role: user.role },
  );

  const model = response.model;
  const category = String(response.category ?? 'ARCHITECTURE');

  const assistantMsg = await dbClient.aiMessage.create({
    data: {
      conversationId: convo.id,
      userId: user.id,
      role: 'assistant',
      content: response.content,
      category,
      model,
      tokenCount: null,
      feedback: null,
      feedbackReason: null,
      meta: {
        mode: response.mode,
        offline: response.offline,
        blocked: response.blocked,
        blockedReason: response.blockedReason ?? null,
        tools: response.tools.map((t) => ({ tool: t.tool, summary: t.summary })),
      },
    },
  });

  // ---- Audited tool executions ----
  for (const t of response.tools) {
    await dbClient.aiToolExecution
      .create({
        data: {
          conversationId: convo.id,
          userId: user.id,
          tool: t.tool,
          input: { prompt: userMsg.content.slice(0, 400) },
          outputSummary: t.summary,
          status: 'SUCCESS',
        },
      })
      .catch(() => {});
  }

  // ---- Conversation metadata ----
  const messageCount = (convo.messageCount ?? 0) + 2;
  const title =
    convo.title && convo.title !== 'New conversation'
      ? convo.title
      : (userMsg.content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New conversation');
  await dbClient.aiConversation.update({
    where: { id: convo.id },
    data: {
      messageCount,
      lastMessageAt: new Date(),
      title,
      context: {
        user: { id: user.id, name: user.name, role: user.role },
        project: response.context.project,
        profile: response.context.profile,
      },
    },
  });

  // ---- Usage ledger ----
  await dbClient.aiUsageLog
    .create({
      data: {
        userId: user.id,
        conversationId: convo.id,
        category,
        model,
        status: 'SUCCESS',
        tokenCount: null,
        latencyMs: Date.now() - started,
        errorCategory: null,
      },
    })
    .catch(() => {});

  return {
    ok: true,
    status: 200,
    data: {
      success: true,
      conversationId: convo.id,
      messageId: assistantMsg.id,
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: response.content,
        category,
        model,
        createdAt: assistantMsg.createdAt,
      },
      response,
    },
  };
}
