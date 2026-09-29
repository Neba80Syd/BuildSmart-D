import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const projectIds = projects.map((p) => p.id);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  const boqs: any[] = [];
  for (const pid of projectIds) boqs.push(...(await dbClient.boq.findMany({ where: { projectId: pid } })));

  const withItems: any[] = [];
  for (const b of boqs) {
    const items: any[] = await dbClient.boqItem.findMany({ where: { boqId: b.id } });
    withItems.push({
      ...b,
      projectName: projName(b.projectId),
      items,
      total: items.reduce((s, i) => s + (i.total ?? 0), 0),
      aiCount: items.filter((i) => i.source === 'AI_ESTIMATE').length,
    });
  }

  const projectId = new URL(req.url).searchParams.get('project');
  const list = projectId ? withItems.filter((b) => b.projectId === projectId) : withItems;

  return NextResponse.json({ boqs: list, projects });
}

const RequestUpdateSchema = z.object({
  boqId: z.string().min(1),
  message: z.string().max(1000).optional(),
});

// Ask the architect to refresh an estimate (real notification, not fake).
export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = RequestUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const boq: any = await dbClient.boq.findUnique({ where: { id: parsed.data.boqId } });
  if (!boq) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const project: any = await dbClient.project.findUnique({ where: { id: boq.projectId } });
  if (!project || project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbClient.notification.create({
    data: { userId: boq.architectId, type: 'PROJECT', title: 'Estimate update requested', body: `${user.name} asked to refresh "${boq.name}".${parsed.data.message ? ` — ${parsed.data.message}` : ''}`, read: 0, link: '/architect/boq', resourceId: boq.id },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: boq.projectId, type: 'PROJECT', title: 'Estimate update requested', body: boq.name } });
  return NextResponse.json({ success: true });
}
