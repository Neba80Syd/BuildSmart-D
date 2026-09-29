import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getArchitectProjects } from '@/Backend/lib/architect';

export const dynamic = 'force-dynamic';

export const PROJECT_STATUSES = [
  'DRAFT', 'REQUIREMENTS', 'DESIGNING', 'AI_GENERATED', 'ARCHITECT_REVIEW',
  'CLIENT_REVIEW', 'REVISION', 'APPROVED', 'CONSTRUCTION_PLANNING', 'COMPLETED', 'ARCHIVED',
] as const;

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const projects = await getArchitectProjects(user.id);
  return NextResponse.json({ projects });
}

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  projectType: z.string().max(60).optional().default('Residential'),
  clientId: z.string().max(60).optional(),
  description: z.string().max(1200).optional(),
  location: z.string().max(160).optional(),
  siteArea: z.number().nonnegative().optional(),
  floors: z.number().int().min(1).max(200).optional(),
  rooms: z.number().int().min(1).max(5000).optional(),
  style: z.string().max(80).optional(),
  budget: z.number().nonnegative().optional(),
  deadline: z.string().optional(),
  requirements: z.array(z.string().max(300)).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid project' }, { status: 400 });

  const project = await dbClient.project.create({
    data: {
      ...parsed.data,
      ownerId: parsed.data.clientId || user.id,
      architectId: user.id,
      status: 'DRAFT',
      progress: 0,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      requirements: parsed.data.requirements ?? [],
      archived: false,
    },
  });
  await dbClient.activity.create({
    data: { userId: user.id, projectId: project.id, type: 'PROJECT', title: 'Project created', body: `${project.name} was created.` },
  });
  return NextResponse.json({ success: true, project }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'archive', 'restore', 'duplicate', 'status']).optional(),
  name: z.string().min(2).max(120).optional(),
  projectType: z.string().max(60).optional(),
  description: z.string().max(1200).optional(),
  location: z.string().max(160).optional(),
  siteArea: z.number().nonnegative().optional(),
  floors: z.number().int().min(1).max(200).optional(),
  rooms: z.number().int().min(1).max(5000).optional(),
  style: z.string().max(80).optional(),
  budget: z.number().nonnegative().optional(),
  deadline: z.string().nullable().optional(),
  requirements: z.array(z.string().max(300)).optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const existing: any = await dbClient.project.findUnique({ where: { id: d.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (d.action === 'duplicate') {
    const copy = await dbClient.project.create({
      data: {
        name: `${existing.name} (Copy)`,
        description: existing.description,
        status: 'DRAFT',
        ownerId: existing.ownerId,
        architectId: user.id,
        budget: existing.budget,
        location: existing.location,
        progress: 0,
        projectType: existing.projectType,
        siteArea: existing.siteArea,
        floors: existing.floors,
        rooms: existing.rooms,
        style: existing.style,
        requirements: existing.requirements ?? [],
        archived: false,
      },
    });
    await dbClient.activity.create({ data: { userId: user.id, projectId: copy.id, type: 'PROJECT', title: 'Project duplicated', body: `${copy.name} created from ${existing.name}.` } });
    return NextResponse.json({ success: true, project: copy });
  }

  if (d.action === 'archive' || d.action === 'restore') {
    const archived = d.action === 'archive';
    const project = await dbClient.project.update({ where: { id: d.id }, data: { archived, status: archived ? 'ARCHIVED' : 'DRAFT' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: d.id, type: 'PROJECT', title: archived ? 'Project archived' : 'Project restored', body: existing.name } });
    return NextResponse.json({ success: true, project });
  }

  const data: any = { ...d };
  delete data.action;
  delete data.id;
  if (d.deadline !== undefined) data.deadline = d.deadline ? new Date(d.deadline) : null;
  const project = await dbClient.project.update({ where: { id: d.id }, data });

  if (d.action === 'status' || d.status) {
    await dbClient.activity.create({ data: { userId: user.id, projectId: d.id, type: 'PROJECT', title: 'Status updated', body: `${existing.name} → ${d.status ?? data.status}` } });
  }
  return NextResponse.json({ success: true, project });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing: any = await dbClient.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // Only draft or archived projects are deletable.
  if (!['DRAFT', 'ARCHIVED'].includes(existing.status)) {
    return NextResponse.json({ error: 'Only draft or archived projects can be deleted' }, { status: 400 });
  }

  await dbClient.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
