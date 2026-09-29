import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export const DESIGN_STATUSES = ['DRAFT', 'AI_GENERATED', 'ARCHITECT_REVIEW', 'CLIENT_REVIEW', 'REVISION', 'APPROVED', 'ARCHIVED'] as const;

const safeJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const designs = await dbClient.design.findMany({ where: { architectId: user.id } });
  const projects: any[] = await dbClient.project.findMany({ where: { architectId: user.id } });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const projectFor = (id: string | null) => projects.find((p) => p.id === id);
  return NextResponse.json({
    designs: designs.map((d: any) => ({
      ...d,
      tags: safeJson(d.tags, []),
      requirements: safeJson(d.requirements, null),
      projectName: projectFor(d.projectId)?.name ?? null,
      clientName: d.clientId ? nameFor(d.clientId) : null,
    })),
  });
}

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(1).max(60),
  type: z.string().max(40).optional(),
  projectId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  thumbnail: z.string().max(300).optional(),
  status: z.enum(DESIGN_STATUSES).optional(),
  tags: z.array(z.string().max(40)).optional(),
  aiGenerated: z.boolean().optional(),
  requirements: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid design' }, { status: 400 });

  const design = await dbClient.design.create({
    data: {
      ...parsed.data,
      architectId: user.id,
      projectId: parsed.data.projectId ?? null,
      clientId: parsed.data.clientId ?? null,
      version: 1,
      status: parsed.data.status ?? (parsed.data.aiGenerated ? 'AI_GENERATED' : 'DRAFT'),
      tags: parsed.data.tags ?? [],
      requirements: parsed.data.requirements ?? null,
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: design.projectId ?? null, type: 'DESIGN', title: 'Design created', body: design.name } });
  return NextResponse.json({ success: true, design }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'duplicate', 'archive', 'restore', 'newVersion', 'approve', 'share']).optional(),
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(1).max(60).optional(),
  type: z.string().max(40).optional(),
  status: z.enum(DESIGN_STATUSES).optional(),
  tags: z.array(z.string().max(40)).optional(),
  thumbnail: z.string().max(300).optional(),
  aiGenerated: z.boolean().optional(),
  requirements: z.any().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const existing: any = await dbClient.design.findUnique({ where: { id: d.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (d.action === 'duplicate') {
    const copy = await dbClient.design.create({
      data: {
        name: `${existing.name} (Copy)`,
        category: existing.category, type: existing.type, projectId: existing.projectId, clientId: existing.clientId,
        thumbnail: existing.thumbnail, status: 'DRAFT', version: 1, tags: existing.tags ?? [], aiGenerated: false,
        requirements: existing.requirements ?? null, architectId: user.id,
      },
    });
    return NextResponse.json({ success: true, design: copy });
  }
  if (d.action === 'newVersion') {
    const v = await dbClient.design.update({ where: { id: d.id }, data: { version: (existing.version ?? 1) + 1 } });
    return NextResponse.json({ success: true, design: v });
  }
  if (d.action === 'archive' || d.action === 'restore') {
    const v = await dbClient.design.update({ where: { id: d.id }, data: { status: d.action === 'archive' ? 'ARCHIVED' : 'DRAFT' } });
    return NextResponse.json({ success: true, design: v });
  }
  if (d.action === 'approve') {
    const v = await dbClient.design.update({ where: { id: d.id }, data: { status: 'APPROVED' } });
    return NextResponse.json({ success: true, design: v });
  }
  if (d.action === 'share') {
    const v = await dbClient.design.update({ where: { id: d.id }, data: { status: 'CLIENT_REVIEW' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId ?? null, type: 'DESIGN', title: 'Design shared with client', body: existing.name } });
    return NextResponse.json({ success: true, design: v });
  }

  const fields: any = { ...d };
  delete fields.action;
  const design = await dbClient.design.update({ where: { id: d.id }, data: fields });
  return NextResponse.json({ success: true, design });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.design.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbClient.design.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
