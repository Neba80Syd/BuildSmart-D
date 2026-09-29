import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const projectIds = projects.map((p) => p.id);
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Architect';
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  // Designs explicitly assigned to this client, plus any belonging to their projects.
  const byClient: any[] = await dbClient.design.findMany({ where: { clientId: user.id } });
  const byProject: any[] = [];
  for (const pid of projectIds) byProject.push(...(await dbClient.design.findMany({ where: { projectId: pid } })));
  const map = new Map<string, any>();
  for (const d of [...byClient, ...byProject]) if (!map.has(d.id)) map.set(d.id, d);

  // Attach 3D floorplan availability per design's project.
  const plansByProject: Record<string, any[]> = {};
  for (const pid of projectIds) {
    plansByProject[pid] = await dbClient.floorPlan.findMany({ where: { projectId: pid, kind: '3D', status: 'PUBLISHED' } });
  }

  const designs = [...map.values()].map((d) => {
    const plans = plansByProject[d.projectId] ?? [];
    return {
      ...d,
      architectName: nameFor(d.architectId),
      projectName: projName(d.projectId),
      tags: parseJson(d.tags, []),
      threeD: plans,
    };
  });

  return NextResponse.json({ designs });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['approve', 'request_revision', 'comment']),
  comment: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.design.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorize: client owns the design's project (or is the design's client).
  const project: any = existing.projectId ? await dbClient.project.findUnique({ where: { id: existing.projectId } }) : null;
  if (!(existing.clientId === user.id || project?.ownerId === user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, comment } = parsed.data;

  if (action === 'approve') {
    const design = await dbClient.design.update({ where: { id: existing.id }, data: { status: 'APPROVED' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId, type: 'DESIGN', title: 'Design approved', body: existing.name } });
    await dbClient.notification.create({ data: { userId: existing.architectId, type: 'DESIGN', title: 'Design approved', body: `${user.name} approved "${existing.name}".`, read: 0 } });
    return NextResponse.json({ success: true, design });
  }

  if (action === 'request_revision') {
    const design = await dbClient.design.update({ where: { id: existing.id }, data: { status: 'REVISION' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId, type: 'DESIGN', title: 'Revision requested', body: comment || existing.name } });
    await dbClient.notification.create({ data: { userId: existing.architectId, type: 'DESIGN', title: 'Revision requested', body: `${user.name} requested changes to "${existing.name}".${comment ? ` — ${comment}` : ''}`, read: 0 } });
    return NextResponse.json({ success: true, design });
  }

  // comment → post into the project activity + notify the architect.
  await dbClient.activity.create({ data: { userId: user.id, projectId: existing.projectId, type: 'DESIGN', title: 'Design comment', body: comment || '' } });
  return NextResponse.json({ success: true, design: existing });
}
