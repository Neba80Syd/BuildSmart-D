import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, clientProject, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';

  const detail = new URL(req.url).searchParams.get('id');
  if (detail) {
    const project = await clientProject(user.id, detail);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const designs: any[] = await dbClient.design.findMany({ where: { projectId: detail } });
    const plans: any[] = await dbClient.floorPlan.findMany({ where: { projectId: detail } });
    const boqs: any[] = await dbClient.boq.findMany({ where: { projectId: detail } });
    const feedback: any[] = await dbClient.floorPlanFeedback.findMany({ where: { projectId: detail } });
    const documents: any[] = await dbClient.document.findMany({ where: { projectId: detail } });
    const activities: any[] = await dbClient.activity.findMany({ where: { projectId: detail, userId: user.id } });
    const appointments: any[] = await dbClient.appointment.findMany({ where: { projectId: detail, clientId: user.id } });
    const rooms: any[] = await dbClient.chatRoom.findMany({ where: { projectId: detail } });

    const boqWithItems: any[] = [];
    for (const b of boqs) {
      const items: any[] = await dbClient.boqItem.findMany({ where: { boqId: b.id } });
      boqWithItems.push({ ...b, items, total: items.reduce((s, i) => s + (i.total ?? 0), 0) });
    }

    return NextResponse.json({
      project: { ...project, architectName: nameFor(project.architectId) },
      designs: designs.map((d) => ({ ...d, tags: parseJson(d.tags, []) })),
      plans: plans.map((p) => ({ ...p, data: parseJson(p.data, null) })),
      boqs: boqWithItems,
      feedback,
      documents: documents.map((d) => ({ ...d, ownerName: nameFor(d.ownerId) })),
      activities,
      appointments,
      chatRooms: rooms,
    });
  }

  return NextResponse.json({ projects });
}

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  projectType: z.string().max(60).optional(),
  location: z.string().max(160).optional(),
  budget: z.number().nonnegative().optional(),
  siteArea: z.number().nonnegative().optional(),
  floors: z.number().int().min(0).optional(),
  rooms: z.number().int().min(0).optional(),
  style: z.string().max(80).optional(),
  description: z.string().max(600).optional(),
  requirements: z.array(z.string().max(200)).optional(),
  architectId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid project' }, { status: 400 });

  const project = await dbClient.project.create({
    data: {
      ...parsed.data,
      ownerId: user.id,
      architectId: parsed.data.architectId ?? null,
      status: 'DRAFT',
      requirements: parsed.data.requirements ? JSON.stringify(parsed.data.requirements) : '[]',
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: project.id, type: 'PROJECT', title: 'Project created', body: project.name } });
  return NextResponse.json({ success: true, project }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(600).optional(),
  location: z.string().max(160).optional(),
  budget: z.number().nonnegative().optional(),
  action: z.enum(['archive', 'restore']).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing = await clientProject(user.id, parsed.data.id);
  if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, action, ...fields } = parsed.data;
  if (action === 'archive' || action === 'restore') {
    const archived = action === 'archive';
    // Only completed or archived projects can be archived/restored.
    if (archived && !['COMPLETED', 'DRAFT'].includes(existing.status)) {
      return NextResponse.json({ error: 'Only completed or draft projects can be archived' }, { status: 400 });
    }
    const project = await dbClient.project.update({ where: { id }, data: { archived, status: archived ? 'ARCHIVED' : 'DRAFT' } });
    return NextResponse.json({ success: true, project });
  }

  const project = await dbClient.project.update({ where: { id }, data: fields });
  return NextResponse.json({ success: true, project });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing = await clientProject(user.id, id);
  if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['DRAFT', 'ARCHIVED'].includes(existing.status)) {
    return NextResponse.json({ error: 'Only draft or archived projects can be deleted' }, { status: 400 });
  }
  await dbClient.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
