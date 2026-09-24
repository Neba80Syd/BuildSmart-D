import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { runCopilot, ALLOWED_ROLES } from '@/Backend/lib/copilot/run';
import { dbClient } from '@/Backend/lib/db';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    const user = await resolveUser('ARCHITECT');
    if (!ALLOWED_ROLES.includes(user.role)) {
      return jsonError('The AI Copilot is available to architects and platform administrators.', 403);
    }

    const body = await req.json().catch(() => null);
    const result = await runCopilot(body, { id: user.id, name: user.name, role: user.role }, started);

    if (!result.ok) {
      if (result.status === 429) {
        return NextResponse.json(
          { error: result.error },
          { status: 429, headers: { 'Retry-After': '30' } },
        );
      }
      return jsonError(result.error, result.status);
    }

    return NextResponse.json(result.data);
  } catch (err: any) {
    console.error('[ai/copilot]', err?.message ?? err);

    if (err?.status === 503) {
      return jsonError('Gemini is not configured on the server. Please set GEMINI_API_KEY.', 503);
    }

    try {
      const user = await resolveUser('ARCHITECT');
      await dbClient.aiUsageLog
        .create({
          data: {
            userId: user.id,
            conversationId: null,
            category: 'ERROR',
            model: null,
            status: 'ERROR',
            tokenCount: null,
            latencyMs: Date.now() - started,
            errorCategory: err?.status ? `http-${err.status}` : 'internal',
          },
        })
        .catch(() => {});
    } catch {
      // Logging failure is non-fatal.
    }

    return jsonError('The AI Copilot is temporarily unavailable. Please try again.', 500);
  }
}
