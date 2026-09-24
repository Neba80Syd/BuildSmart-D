import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];
const UpdateSchema = z.object({
  title: z.string().max(120).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  mode: z.string().max(40).optional(),
  projectId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const messages = await dbClient.aiMessage.findMany({
      where: { conversationId: convo.id, userId: user.id },
    });
    return NextResponse.json({ success: true, conversation: convo, messages });
  } catch (err: any) {
    console.error('[ai/conversation]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to load conversation.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const { projectId } = parsed.data;
    if (projectId) {
      const project = await dbClient.project.findUnique({ where: { id: projectId } });
      const allowed = project && (project.ownerId === user.id || project.architectId === user.id || user.role === 'ADMIN');
      if (!allowed) {
        return NextResponse.json({ error: 'Project not found for this user.' }, { status: 404 });
      }
    }

    const updated = await dbClient.aiConversation.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ success: true, conversation: updated });
  } catch (err: any) {
    console.error('[ai/conversation]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to update conversation.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await dbClient.aiMessage.deleteMany({ where: { conversationId: id } });
    await dbClient.aiConversation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ai/conversation]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to delete conversation.' }, { status: 500 });
  }
}
