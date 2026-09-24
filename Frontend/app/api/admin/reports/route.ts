import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const targetType = searchParams.get('targetType');

  const reports: any[] = await dbClient.report.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  if (id) {
    const r = reports.find((x) => x.id === id);
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ report: { ...r, assigneeName: r.assignedTo ? nameFor(r.assignedTo) : null } });
  }

  const list = reports
    .filter((r) => (status ? r.status === status : true))
    .filter((r) => (targetType ? r.targetType === targetType : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({ ...r, assigneeName: r.assignedTo ? nameFor(r.assignedTo) : null }));

  return NextResponse.json({ reports: list, statuses: ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED', 'ESCALATED', 'RESOLVED'], targetTypes: [...new Set(reports.map((r) => r.targetType))] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['assign', 'dismiss', 'escalate', 'resolve', 'action']),
  assigneeId: z.string().optional(),
  note: z.string().max(1000).optional(),
  resolution: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.report.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.action === 'assign') data.assignedTo = parsed.data.assigneeId ?? null;
  if (parsed.data.action === 'dismiss') data.status = 'DISMISSED';
  if (parsed.data.action === 'escalate') data.status = 'ESCALATED';
  if (parsed.data.action === 'resolve') { data.status = 'RESOLVED'; data.resolution = parsed.data.resolution ?? ''; }
  if (parsed.data.action === 'action') { data.status = 'ACTIONED'; data.resolution = parsed.data.resolution ?? ''; }

  const updated = await dbClient.report.update({ where: { id: existing.id }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `REPORT_${parsed.data.action.toUpperCase()}`, resource: 'REPORT', resourceId: existing.id, reason: parsed.data.note ?? parsed.data.resolution ?? null });
  await notifyUser(existing.reporterId, 'Report updated', `Your report (${existing.category}) was reviewed by moderation.`);

  return NextResponse.json({ success: true, report: updated });
}
