import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

// Map notification `type` → the client dashboard's notification category.
export function categoryFor(type: string): string {
  const map: Record<string, string> = {
    PROJECT: 'Projects', REQUEST: 'Requests', DESIGN: 'Design', '3D_FLOORPLAN': '3D Floorplan',
    ARCHITECT: 'Architect', VERIFICATION: 'Verification', ORDER: 'Marketplace', PRODUCT: 'Marketplace',
    MARKETPLACE: 'Marketplace', PAYMENT: 'Payments', MESSAGE: 'Messages', APPOINTMENT: 'Appointments', SYSTEM: 'System',
  };
  return map[type] ?? 'Projects';
}

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') ?? 'all'; // all | unread | <category>
  const q = (searchParams.get('q') ?? '').toLowerCase();

  const items: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const list = items
    .filter((n) => (filter === 'unread' ? !n.read : filter !== 'all' ? categoryFor(n.type) === filter : true))
    .filter((n) => (q ? (n.title + ' ' + (n.body ?? '')).toLowerCase().includes(q) : true));

  const categories = ['Projects', 'Requests', 'Design', '3D Floorplan', 'Architect', 'Verification', 'Marketplace', 'Payments', 'Messages', 'Appointments', 'System'];
  const counts: Record<string, number> = {};
  for (const c of categories) counts[c] = items.filter((n) => categoryFor(n.type) === c && !n.read).length;

  return NextResponse.json({
    notifications: list.map((n) => ({ ...n, category: categoryFor(n.type) })),
    unread: items.filter((n) => !n.read).length,
    counts,
    categories,
  });
}

const PatchSchema = z.object({
  read: z.boolean(),
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { read, ids, markAll } = body.data;
  const all: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const targets = markAll ? all : all.filter((n) => (ids ?? []).includes(n.id));
  for (const n of targets) await dbClient.notification.update({ where: { id: n.id }, data: { read } });
  return NextResponse.json({ success: true });
}

const DeleteSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const body = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const all: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const targets = body.data.all ? all : all.filter((n) => (body.data.ids ?? []).includes(n.id));
  for (const n of targets) await dbClient.notification.delete({ where: { id: n.id } });
  return NextResponse.json({ success: true });
}
