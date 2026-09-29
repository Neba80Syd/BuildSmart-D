import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];
const FeedbackSchema = z.object({
  messageId: z.string().min(1).max(120),
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL']),
  reason: z.string().max(300).optional(),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser('ARCHITECT');
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const convo = await dbClient.aiConversation.findUnique({ where: { id } });
    if (!convo || convo.userId !== user.id) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    const parsed = FeedbackSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid feedback.' }, { status: 400 });
    }
    const { messageId, rating, reason, comment } = parsed.data;

    const msg = await dbClient.aiMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.conversationId !== convo.id || msg.userId !== user.id) {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }

    const feedback = await dbClient.aiFeedback.create({
      data: {
        conversationId: convo.id,
        messageId,
        userId: user.id,
        rating,
        reason: reason ?? null,
        comment: comment ?? null,
      },
    });

    await dbClient.aiMessage.update({
      where: { id: messageId },
      data: { feedback: rating, feedbackReason: reason ?? null },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (err: any) {
    console.error('[ai/feedback]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to save feedback.' }, { status: 500 });
  }
}
