import { NextRequest } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { runCopilot, ALLOWED_ROLES } from '@/Backend/lib/copilot/run';

function sse(data: string, event?: string): string {
  const line = event ? `event: ${event}\n` : '';
  return `${line}data: ${data}\n\n`;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const encoder = new TextEncoder();

  const user = await resolveUser('ARCHITECT');

  if (!ALLOWED_ROLES.includes(user.role)) {
    return new Response(sse(JSON.stringify({ error: 'Forbidden' })), {
      status: 403,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  const body = await req.json().catch(() => null);
  const result = await runCopilot(body, { id: user.id, name: user.name, role: user.role }, started);

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string, event?: string) => controller.enqueue(encoder.encode(sse(chunk, event)));

      if (!result.ok) {
        write(JSON.stringify({ error: result.error }), 'error');
        write('{}', 'done');
        controller.close();
        return;
      }

      const { content, ...meta } = result.data.response ?? {};
      const full = result.data;

      // Emit the assistant text in word-sized deltas so the UI can stream the
      // response even when the underlying provider returns one payload.
      const words = String(content ?? '').split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        write(JSON.stringify({ delta: word }), 'delta');
      }

      write(
        JSON.stringify({
          conversationId: full.conversationId,
          messageId: full.messageId,
          message: full.message,
          response: { ...meta, content },
        }),
        'done',
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
