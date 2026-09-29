import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { generateMaterialEstimate } from '@/Backend/lib/estimation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const boqs = await dbClient.boq.findMany({ where: { architectId: user.id } });
  const itemsByBoq: Record<string, any[]> = {};
  for (const b of boqs) {
    itemsByBoq[b.id] = await dbClient.boqItem.findMany({ where: { boqId: b.id } });
  }

  if (id) {
    const boq: any = await dbClient.boq.findUnique({ where: { id } });
    if (!boq) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (boq.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ boq, items: itemsByBoq[id] ?? [] });
  }

  return NextResponse.json({ boqs, itemsByBoq });
}

const ItemSchema = z.object({
  category: z.string().min(1).max(60),
  material: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  unit: z.string().min(1).max(20),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  source: z.string().max(30).optional(),
  notes: z.string().max(300).optional(),
  linkedProductId: z.string().nullable().optional(),
});

const CreateSchema = z.object({
  projectId: z.string().nullable().optional(),
  name: z.string().min(2).max(120),
  notes: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'FINAL', 'SENT']).optional(),
  generate: z.boolean().optional(),
  items: z.array(ItemSchema).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid BOQ' }, { status: 400 });

  const projectId = parsed.data.projectId ?? null;
  if (projectId) {
    const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // AI-assisted estimate generation when requested (clearly marked as estimates).
  let items = (parsed.data.items ?? []).map((i) => ({ ...i, total: i.total ?? (i.quantity ?? 0) * (i.unitPrice ?? 0), source: i.source ?? 'MANUAL' }));
  if (parsed.data.generate && projectId) {
    const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
    items = generateMaterialEstimate(project).map((i) => ({ ...i, source: 'AI_ESTIMATE' }));
  }

  const boq = await dbClient.boq.create({
    data: { architectId: user.id, projectId, name: parsed.data.name, notes: parsed.data.notes ?? '', status: parsed.data.status ?? 'DRAFT', version: 1 },
  });
  if (items.length) {
    await dbClient.boqItem.createMany({ data: items.map((i: any) => ({ ...i, boqId: boq.id, linkedProductId: i.linkedProductId ?? null })) });
  }
  await dbClient.activity.create({ data: { userId: user.id, projectId, type: 'PROJECT', title: 'BOQ created', body: boq.name } });
  return NextResponse.json({ success: true, boq, items: await dbClient.boqItem.findMany({ where: { boqId: boq.id } }) }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['update', 'setStatus', 'newVersion']).optional(),
  name: z.string().min(2).max(120).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'FINAL', 'SENT']).optional(),
  items: z.array(ItemSchema).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const existing: any = await dbClient.boq.findUnique({ where: { id: d.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (d.action === 'newVersion') {
    const v = await dbClient.boq.update({ where: { id: d.id }, data: { version: (existing.version ?? 1) + 1 } });
    return NextResponse.json({ success: true, boq: v });
  }

  const data: any = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.notes !== undefined) data.notes = d.notes;
  if (d.status !== undefined) data.status = d.status;
  let boq = existing;
  if (Object.keys(data).length) boq = await dbClient.boq.update({ where: { id: d.id }, data });

  // Replace line items (manual override of AI quantities).
  if (d.items) {
    await dbClient.boqItem.deleteMany({ where: { boqId: d.id } });
    await dbClient.boqItem.createMany({
      data: d.items.map((i) => ({ ...i, boqId: d.id, total: i.total ?? (i.quantity ?? 0) * (i.unitPrice ?? 0), linkedProductId: i.linkedProductId ?? null })),
    });
  }
  await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId ?? null, type: 'PROJECT', title: 'BOQ updated', body: existing.name } });
  return NextResponse.json({ success: true, boq, items: await dbClient.boqItem.findMany({ where: { boqId: d.id } }) });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.boq.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbClient.boqItem.deleteMany({ where: { boqId: id } });
  await dbClient.boq.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
