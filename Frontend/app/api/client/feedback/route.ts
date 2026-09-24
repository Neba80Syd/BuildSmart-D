import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export const FEEDBACK_CATEGORIES = [
  'Room Layout', 'Room Size', 'Doors and Windows', 'Furniture Placement',
  'Interior Appearance', 'Exterior Appearance', 'Materials', 'Colors',
  'Lighting', 'Floor Selection', 'Circulation', 'Accessibility',
  'Missing Element', 'Incorrect Element', 'General Feedback', 'Other',
] as const;

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project');
  const planId = searchParams.get('plan');

  const projects = await dbClient.project.findMany({ where: { ownerId: user.id } });
  const ids = projects.map((p) => p.id);

  const all: any[] = [];
  for (const pid of ids) all.push(...(await dbClient.floorPlanFeedback.findMany({ where: { projectId: pid } })));
  const items = all.filter((f) => (projectId ? f.projectId === projectId : true)).filter((f) => (planId ? f.floorPlanId === planId : true));

  return NextResponse.json({ feedback: items });
}

const SubmitSchema = z.object({
  floorPlanId: z.string().min(1),
  floor: z.string().max(80).optional(),
  area: z.string().max(120).optional(),
  category: z.enum(FEEDBACK_CATEGORIES),
  description: z.string().min(5).max(2000),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  marker: z.object({ x: z.number(), y: z.number(), floor: z.string().optional(), note: z.string().max(200).optional() }).optional(),
  attachments: z.array(z.object({ name: z.string().max(200), kind: z.string().max(40) })).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = SubmitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid feedback' }, { status: 400 });

  // 1) The floorplan must be a published 3D floorplan.
  const plan: any = await dbClient.floorPlan.findUnique({ where: { id: parsed.data.floorPlanId } });
  if (!plan || plan.kind !== '3D') return NextResponse.json({ error: 'Not a 3D floorplan' }, { status: 404 });
  if (plan.status !== 'PUBLISHED') return NextResponse.json({ error: 'This 3D floorplan is not published yet' }, { status: 400 });

  // 2) The client must own the project the floorplan belongs to.
  const project: any = await dbClient.project.findUnique({ where: { id: plan.projectId } });
  if (!project || project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 3) Create a structured review record — never mutates the source model.
  const feedback = await dbClient.floorPlanFeedback.create({
    data: {
      projectId: plan.projectId,
      floorPlanId: plan.id,
      clientId: user.id,
      version: plan.version,
      floor: parsed.data.floor ?? '',
      area: parsed.data.area ?? '',
      category: parsed.data.category,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: 'SUBMITTED',
      marker: parsed.data.marker ? JSON.stringify(parsed.data.marker) : null,
      attachments: parsed.data.attachments?.length ? JSON.stringify(parsed.data.attachments) : null,
    },
  });

  // 4) Reflect the review state on the floorplan (no geometry change).
  await dbClient.floorPlan.update({ where: { id: plan.id }, data: { reviewStatus: 'FEEDBACK_SUBMITTED' } });

  // 5) Notify the architect + record client activity.
  await dbClient.notification.create({
    data: {
      userId: project.architectId,
      type: '3D_FLOORPLAN',
      title: 'New 3D floorplan feedback',
      body: `${user.name} submitted feedback on ${plan.name} (${parsed.data.category}).`,
      read: 0,
      link: `/architect/3d?project=${plan.projectId}`,
      resourceId: plan.id,
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: plan.projectId, type: 'DESIGN', title: '3D feedback submitted', body: `${parsed.data.category} — ${parsed.data.description.slice(0, 80)}` } });

  return NextResponse.json({ success: true, feedback }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  action: z.enum(['withdraw']),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.floorPlanFeedback.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.clientId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['SUBMITTED', 'RECEIVED'].includes(existing.status)) return NextResponse.json({ error: 'This feedback can no longer be withdrawn' }, { status: 400 });

  const feedback = await dbClient.floorPlanFeedback.update({ where: { id: existing.id }, data: { status: 'CLOSED' } });
  return NextResponse.json({ success: true, feedback });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.floorPlanFeedback.findUnique({ where: { id } });
  if (!existing || existing.clientId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbClient.floorPlanFeedback.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
