import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project');
  const planId = searchParams.get('plan');
  const kind = searchParams.get('kind');

  const authorizedIds = new Set(projects.map((p) => p.id));

  const all: any[] = [];
  for (const pid of authorizedIds) {
    if (projectId && pid !== projectId) continue;
    all.push(...(await dbClient.floorPlan.findMany({ where: { projectId: pid } })));
  }

  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  // Clients only ever see PUBLISHED plans (2D) and PUBLISHED + in-progress 3D states.
  const visible = all
    .filter((p) => (p.kind === '3D' ? ['PUBLISHED', 'GENERATING', 'PROCESSING'].includes(p.status) : p.status === 'PUBLISHED'))
    .filter((p) => (kind ? p.kind === kind : true))
    .map((p) => ({
      ...p,
      projectName: projName(p.projectId),
      // Never expose the raw model of an unpublished 3D floorplan.
      data: p.status === 'PUBLISHED' ? parseJson(p.data, null) : null,
    }));

  const feedback: any[] = [];
  for (const pid of authorizedIds) feedback.push(...(await dbClient.floorPlanFeedback.findMany({ where: { projectId: pid } })));

  // Version history per project for 3D plans.
  const versions: Record<string, any[]> = {};
  for (const p of visible.filter((x) => x.kind === '3D' && x.status === 'PUBLISHED')) {
    const key = `${p.projectId}:${p.name.replace(/\s+V\d+$/, '')}`;
    (versions[key] ??= []).push({ id: p.id, name: p.name, version: p.version, reviewStatus: p.reviewStatus, publishedAt: p.publishedAt });
  }

  return NextResponse.json({ projects, floorPlans: visible, feedback, versions, focus: planId ? visible.find((p) => p.id === planId) : null });
}

// Review actions on a published 2D plan — ask a question or request a change.
// The client never edits the plan itself.
const ReviewSchema = z.object({
  planId: z.string().min(1),
  action: z.enum(['ask', 'request_change']),
  message: z.string().min(2).max(1000),
  area: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const plan: any = await dbClient.floorPlan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || plan.status !== 'PUBLISHED') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project: any = await dbClient.project.findUnique({ where: { id: plan.projectId } });
  if (!project || project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbClient.notification.create({
    data: {
      userId: project.architectId,
      type: 'DESIGN',
      title: parsed.data.action === 'ask' ? 'Question about floor plan' : 'Change requested on floor plan',
      body: `${user.name} on "${plan.name}"${parsed.data.area ? ` (${parsed.data.area})` : ''}: ${parsed.data.message}`,
      read: 0,
      link: '/architect/floorplans',
      resourceId: plan.id,
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: plan.projectId, type: 'DESIGN', title: parsed.data.action === 'ask' ? 'Plan question asked' : 'Plan change requested', body: parsed.data.message } });
  return NextResponse.json({ success: true });
}
