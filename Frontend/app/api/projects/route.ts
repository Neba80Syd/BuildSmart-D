import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

function withArchitect(p: any, users: any[]) {
  const u = users.find((x: any) => x.id === p.architectId);
  return { ...p, architectName: u?.name ?? 'Unassigned' };
}

export async function GET() {
  const user = await resolveUser('CLIENT');
  let projects: any[] = await dbClient.project.findMany();
  const users = await dbClient.user.findMany();

  // Client sees own projects; architect sees assigned; admin sees all.
  if (user.role === 'CLIENT') projects = projects.filter((p: any) => p.ownerId === user.id);
  else if (user.role === 'ARCHITECT') projects = projects.filter((p: any) => p.architectId === user.id);

  return NextResponse.json({ projects: projects.map((p: any) => withArchitect(p, users)) });
}

const ProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(600).optional(),
  status: z.enum(['DESIGNING', 'PROCUREMENT', 'APPROVED', 'COMPLETED']).default('DESIGNING'),
  budget: z.number().nonnegative().optional(),
  location: z.string().max(160).optional(),
  architectId: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid project' }, { status: 400 });

  const project = await dbClient.project.create({
    data: {
      ...parsed.data,
      ownerId: user.id,
      architectId: parsed.data.architectId ?? null,
      description: parsed.data.description ?? '',
      budget: parsed.data.budget ?? 0,
      location: parsed.data.location ?? '',
    },
  });
  return NextResponse.json({ success: true, project }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(600).optional(),
  status: z.enum(['DESIGNING', 'PROCUREMENT', 'APPROVED', 'COMPLETED']).optional(),
  budget: z.number().nonnegative().optional(),
  location: z.string().max(160).optional(),
  progress: z.number().min(0).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.project.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.ownerId !== user.id && existing.architectId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, ...data } = parsed.data;
  const project = await dbClient.project.update({ where: { id }, data });
  return NextResponse.json({ success: true, project });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing: any = await dbClient.project.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbClient.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
