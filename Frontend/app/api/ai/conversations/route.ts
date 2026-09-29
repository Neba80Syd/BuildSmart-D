import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];
const CreateSchema = z.object({
  title: z.string().max(120).optional(),
  mode: z.string().max(40).optional(),
  projectId: z.string().nullable().optional(),
});

function canAccessProject(project: any, userId: string, role: string) {
  return project && (project.ownerId === userId || project.architectId === userId || role === 'ADMIN');
}

export async function GET() {
  try {
    const user = await resolveUser('ARCHITECT');
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const conversations = await dbClient.aiConversation.findMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true, conversations });
  } catch (err: any) {
    console.error('[ai/conversations]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to load conversations.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const { title, mode, projectId } = parsed.data;

    if (projectId) {
      const project = await dbClient.project.findUnique({ where: { id: projectId } });
      if (!canAccessProject(project, user.id, user.role)) {
        return NextResponse.json({ error: 'Project not found for this user.' }, { status: 404 });
      }
    }

    const convo = await dbClient.aiConversation.create({
      data: {
        userId: user.id,
        title: title?.trim() || 'New conversation',
        mode: mode ?? 'architecture',
        projectId: projectId ?? null,
        status: 'ACTIVE',
        messageCount: 0,
        lastMessageAt: null,
      },
    });
    return NextResponse.json({ success: true, conversation: convo }, { status: 201 });
  } catch (err: any) {
    console.error('[ai/conversations]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to create conversation.' }, { status: 500 });
  }
}
