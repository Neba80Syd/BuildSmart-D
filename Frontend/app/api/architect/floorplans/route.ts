import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

// Resolve the project and verify architect ownership (server-side authz).
async function ownsProject(userId: string, projectId: string) {
  const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (project.architectId !== userId) return 'forbidden';
  return project;
}

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (projectId) {
    const project = await ownsProject(user.id, projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let plans: any[] = [];
  if (projectId) {
    plans = await dbClient.floorPlan.findMany({ where: { projectId } });
  } else {
    // All plans for the architect's projects.
    const projects: any[] = await dbClient.project.findMany({ where: { architectId: user.id } });
    const ids = projects.map((p) => p.id);
    for (const pid of ids) {
      plans = plans.concat(await dbClient.floorPlan.findMany({ where: { projectId: pid } }));
    }
  }
  return NextResponse.json({ floorPlans: plans.map((p: any) => ({ ...p, data: safeJson(p.data, null) })) });
}

const safeJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const CreateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  data: z.any().optional(),
  svgData: z.string().optional(),
  kind: z.enum(['2D', '3D']).optional(),
  version: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid floor plan' }, { status: 400 });

  const project = await ownsProject(user.id, parsed.data.projectId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  if (project === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const plan = await dbClient.floorPlan.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      data: parsed.data.data != null ? JSON.stringify(parsed.data.data) : null,
      svgData: parsed.data.svgData ?? null,
      kind: parsed.data.kind ?? '2D',
      version: parsed.data.version ?? 1,
      status: parsed.data.kind === '3D' ? 'PROCESSING' : 'DRAFT',
      reviewStatus: parsed.data.kind === '3D' ? 'PROCESSING' : 'NOT_STARTED',
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: parsed.data.projectId, type: 'DESIGN', title: 'Floor plan saved', body: parsed.data.name } });
  return NextResponse.json({ success: true, floorPlan: plan }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  data: z.any().optional(),
  svgData: z.string().optional(),
  // Architect workflow actions: 'generate' starts generation, 'publish' makes a
  // completed 3D floorplan visible to the client and notifies them.
  action: z.enum(['publish', 'generate']).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.floorPlan.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project = await ownsProject(user.id, existing.projectId);
  if (!project || project === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Publish a completed 2D or 3D floorplan to the client.
  if (parsed.data.action === 'publish') {
    const is3D = existing.kind === '3D';
    const plan = await dbClient.floorPlan.update({
      where: { id: existing.id },
      data: { status: 'PUBLISHED', reviewStatus: 'READY_FOR_REVIEW', publishedAt: new Date(), updatedAt: new Date() },
    });
    await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId, type: 'DESIGN', title: `${existing.kind} floor plan published`, body: `${existing.name} V${existing.version}` } });
    await dbClient.activity.create({ data: { userId: project.ownerId, projectId: existing.projectId, type: 'DESIGN', title: `${existing.kind} floor plan published`, body: `Architect ${user.name} published ${existing.name} V${existing.version}.` } });
    await dbClient.notification.create({
      data: {
        userId: project.ownerId,
        type: is3D ? '3D_FLOORPLAN' : 'DESIGN',
        title: `Your ${existing.kind} floor plan is ready to view`,
        body: `Architect ${user.name} published ${existing.name} V${existing.version} for ${project.name}. It is now ready for your review.`,
        read: 0,
        link: is3D ? `/client/3d?project=${existing.projectId}&plan=${existing.id}` : `/client/floorplans?project=${existing.projectId}&plan=${existing.id}`,
        resourceId: existing.id,
      },
    });
    return NextResponse.json({ success: true, floorPlan: plan });
  }

  // Start generation (mock the generation pipeline state machine).
  if (parsed.data.action === 'generate') {
    const plan = await dbClient.floorPlan.update({ where: { id: existing.id }, data: { status: 'GENERATING', reviewStatus: 'GENERATING', updatedAt: new Date() } });
    return NextResponse.json({ success: true, floorPlan: plan });
  }

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.data !== undefined) data.data = JSON.stringify(parsed.data.data);
  if (parsed.data.svgData !== undefined) data.svgData = parsed.data.svgData;
  data.updatedAt = new Date();
  const plan = await dbClient.floorPlan.update({ where: { id: parsed.data.id }, data });
  return NextResponse.json({ success: true, floorPlan: plan });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.floorPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project = await ownsProject(user.id, existing.projectId);
  if (!project || project === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Delete plan: use deleteMany-free approach via the floorPlan.delete helper.
  await dbClient.floorPlan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
