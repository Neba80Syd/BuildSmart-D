import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const requests: any[] = await dbClient.designRequest.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  if (id) {
    const r = requests.find((x) => x.id === id);
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ request: { ...r, clientName: nameFor(r.clientId), architectName: nameFor(r.architectId), requirements: parseJson(r.requirements, {}) } });
  }

  const list = requests
    .filter((r) => (status ? r.status === status : true))
    .filter((r) => (q ? `${r.projectType ?? ''} ${r.description ?? ''} ${r.location ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({
      id: r.id,
      projectType: r.projectType,
      description: r.description,
      location: r.location,
      clientName: nameFor(r.clientId),
      architectName: nameFor(r.architectId),
      status: r.status,
      budget: r.budget,
      createdAt: r.createdAt,
    }));

  return NextResponse.json({ requests: list, statuses: [...new Set(requests.map((r) => r.status))] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['escalate', 'close', 'note']),
  note: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.designRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.action === 'escalate') data.status = 'ESCALATED';
  if (parsed.data.action === 'close') data.status = 'CANCELLED';
  const updated = Object.keys(data).length ? await dbClient.designRequest.update({ where: { id: existing.id }, data }) : existing;

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `REQUEST_${parsed.data.action.toUpperCase()}`, resource: 'DESIGN_REQUEST', resourceId: existing.id, reason: parsed.data.note ?? null });

  return NextResponse.json({ success: true, request: updated });
}
