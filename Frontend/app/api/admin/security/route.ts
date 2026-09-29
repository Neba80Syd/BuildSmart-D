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
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');

  const events: any[] = await dbClient.securityEvent.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id?: string | null) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  if (id) {
    const e = events.find((x) => x.id === id);
    if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ event: { ...e, actorName: nameFor(e.actorId), targetName: nameFor(e.targetId), notes: parseJson(e.notes, []) } });
  }

  const list = events
    .filter((e) => (severity ? e.severity === severity : true))
    .filter((e) => (status ? e.status === status : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((e) => ({ ...e, actorName: nameFor(e.actorId), targetName: nameFor(e.targetId) }));

  const counts: Record<string, number> = {};
  for (const e of events) counts[e.severity] = (counts[e.severity] ?? 0) + 1;

  return NextResponse.json({ events: list, severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], statuses: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'], counts });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['investigate', 'resolve', 'dismiss', 'note', 'lock_account', 'revoke_sessions']),
  note: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.securityEvent.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.action === 'investigate') data.status = 'INVESTIGATING';
  if (parsed.data.action === 'resolve') data.status = 'RESOLVED';
  if (parsed.data.action === 'dismiss') data.status = 'DISMISSED';
  if (parsed.data.action === 'note') {
    const notes: any[] = parseJson(existing.notes, []);
    notes.push({ at: new Date().toISOString(), author: auth.user.name, text: parsed.data.note ?? '' });
    data.notes = notes;
  }
  if (parsed.data.action === 'lock_account' && existing.targetId) {
    const target: any = await dbClient.user.findUnique({ where: { id: existing.targetId } });
    if (target && target.role !== 'ADMIN') await dbClient.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED' } });
    data.status = 'RESOLVED';
  }
  if (parsed.data.action === 'revoke_sessions') data.status = 'RESOLVED';

  const updated = await dbClient.securityEvent.update({ where: { id: existing.id }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `SECURITY_${parsed.data.action.toUpperCase()}`, resource: 'SECURITY_EVENT', resourceId: existing.id, reason: parsed.data.note ?? null });
  if (parsed.data.action === 'lock_account' && existing.targetId) await notifyUser(existing.targetId, 'Account locked', 'Your account was locked after a security review.');

  return NextResponse.json({ success: true, event: { ...updated, notes: parseJson(updated.notes, []) } });
}
