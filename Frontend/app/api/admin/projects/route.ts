import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const projects: any[] = await dbClient.project.findMany();
  const users: any[] = await dbClient.user.findMany();
  const disputes: any[] = await dbClient.dispute.findMany();
  const nameFor = (id?: string | null) => users.find((u) => u.id === id)?.name ?? 'Unassigned';

  if (id) {
    const p = projects.find((x) => x.id === id);
    if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const activities: any[] = await dbClient.activity.findMany({ where: { projectId: id } });
    const designs: any[] = await dbClient.design.findMany({ where: { projectId: id } });
    const floorplans: any[] = await dbClient.floorPlan.findMany({ where: { projectId: id } });
    return NextResponse.json({
      project: { ...p, clientName: nameFor(p.ownerId), architectName: nameFor(p.architectId), requirements: parseJson(p.requirements, []) },
      participants: [
        { role: 'Client', name: nameFor(p.ownerId), id: p.ownerId },
        { role: 'Architect', name: nameFor(p.architectId), id: p.architectId },
      ],
      activity: activities.slice(0, 20),
      designs,
      floorplans,
      disputes: disputes.filter((d) => d.projectId === id),
    });
  }

  const list = projects
    .filter((p) => (status ? p.status === status : true))
    .filter((p) => (q ? `${p.name ?? ''} ${p.location ?? ''} ${p.projectType ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((p) => ({
      id: p.id,
      name: p.name,
      clientName: nameFor(p.ownerId),
      architectName: nameFor(p.architectId),
      status: p.status,
      progress: p.progress,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      disputes: disputes.filter((d) => d.projectId === p.id).length,
      flagged: p.archived,
    }));

  return NextResponse.json({ projects: list, statuses: [...new Set(projects.map((p) => p.status))] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['flag', 'unflag', 'suspend', 'resume']),
  reason: z.string().max(500).optional(),
});

// Monitoring only — an administrator never edits architectural work itself.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const project: any = await dbClient.project.findUnique({ where: { id: parsed.data.id } });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { action, reason } = parsed.data;
  const data: any = {};
  if (action === 'flag') data.archived = true;
  if (action === 'unflag' || action === 'resume') data.archived = false;
  if (action === 'suspend') data.status = 'SUSPENDED';
  if (action === 'resume') data.status = 'REQUIREMENTS';

  const updated = await dbClient.project.update({ where: { id: project.id }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `PROJECT_${action.toUpperCase()}`, resource: 'PROJECT', resourceId: project.id, reason: reason ?? null });
  await notifyUser(project.architectId, 'Project flagged by administration', `${project.name} was ${action === 'flag' ? 'flagged' : action === 'suspend' ? 'suspended' : 'resumed'}${reason ? `: ${reason}` : ''}.`);

  return NextResponse.json({ success: true, project: updated });
}
