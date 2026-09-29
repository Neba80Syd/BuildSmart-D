import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { floorPlanBoqService } from '@/Backend/services/estimation/floorplan-boq.service';

export const dynamic = 'force-dynamic';

const SendSchema = z.object({
  boqId: z.string().min(1),
  clientId: z.string().optional(),
  message: z.string().max(1000).optional(),
  notifyClient: z.boolean().optional().default(true),
  postToChat: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const body = await req.json().catch(() => ({}));
    const parsed = SendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid parameters' },
        { status: 400 }
      );
    }

    const result = await floorPlanBoqService.forwardBoqToClient({
      boqId: parsed.data.boqId,
      architectId: user.id,
      clientId: parsed.data.clientId,
      message: parsed.data.message,
      notifyClient: parsed.data.notifyClient,
      postToChat: parsed.data.postToChat,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[send-to-client] BOQ forwarding failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to forward BOQ to client' },
      { status: 500 }
    );
  }
}
