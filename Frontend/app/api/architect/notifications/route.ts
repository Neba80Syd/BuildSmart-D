import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export const NOTIFICATION_CATEGORIES = [
  'PROJECTS', 'REQUESTS', 'CLIENTS', 'VERIFICATION', 'MARKETPLACE', 'PAYMENTS', 'MESSAGES', 'SYSTEM', 'AI', 'APPOINTMENTS', 'REVIEWS',
] as const;

// Map raw notification types to dashboard categories.
const CATEGORY_BY_TYPE: Record<string, string> = {
  PROJECT: 'PROJECTS', REQUEST: 'REQUESTS', CLIENT: 'CLIENTS', VERIFICATION: 'VERIFICATION', ORDER: 'MARKETPLACE',
  PAYMENT: 'PAYMENTS', MESSAGE: 'MESSAGES', SYSTEM: 'SYSTEM', AI: 'AI', APPOINTMENT: 'APPOINTMENTS', REVIEW: 'REVIEWS',
};

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const items: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const categories: Record<string, number> = {};
  const enriched = items.map((n) => {
    const category = CATEGORY_BY_TYPE[n.type] ?? 'SYSTEM';
    categories[category] = (categories[category] ?? 0) + 1;
    return { ...n, category };
  });
  return NextResponse.json({
    notifications: enriched,
    unread: items.filter((n) => !n.read).length,
    categories: Object.keys(categories).sort(),
    counts: categories,
  });
}

const PatchSchema = z.object({
  read: z.boolean(),
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { read, ids, markAll } = body.data;
  const all: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const targets = markAll ? all : all.filter((n) => (ids ?? []).includes(n.id));
  for (const n of targets) await dbClient.notification.update({ where: { id: n.id }, data: { read } });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const items: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const target = items.find((n) => n.id === id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Soft-delete via read flag is not deletion; notifications table has no delete helper, so mark read.
  await dbClient.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json({ success: true, note: 'Notification dismissed (marked read).' });
}
