import { NextRequest } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { subscribe } from '@/Backend/lib/chat-events';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Server-Sent Events stream of new chat messages for the preview team room.
// A heartbeat comment keeps intermediaries from buffering/closing idle streams.
export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const users: any[] = await dbClient.user.findMany();
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Team Member';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* stream already closed */
        }
      };
      const send = (data: any) => enqueue(`data: ${JSON.stringify(data)}\n\n`);

      send({ type: 'connected' });

      const unsubscribe = subscribe((msg: any) => {
        send({
          type: 'message',
          message: {
            ...msg,
            senderName: nameOf(msg.senderId),
            mine: msg.senderId === user.id,
          },
        });
      });

      const keepalive = setInterval(() => enqueue(': keepalive\n\n'), 15000);

      const cleanup = () => {
        unsubscribe();
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      /* client disconnected */
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
