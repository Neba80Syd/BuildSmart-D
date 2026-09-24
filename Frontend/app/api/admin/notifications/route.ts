import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Verification', 'Security', 'Projects', 'Marketplace', 'Payments', 'Support', 'System'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const onlyUnread = searchParams.get('unread') === '1';

  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: auth.user.id } });

  const categoryFor = (n: any) => {
    const t = String(n.type ?? 'SYSTEM');
    if (t === 'VERIFICATION') return 'Verification';
    if (t === 'SYSTEM') return 'System';
    if (t.includes('SECURITY')) return 'Security';
    if (t === 'PAYMENT') return 'Payments';
    if (t === 'ORDER') return 'Marketplace';
    if (t === 'PROJECT' || t === 'DESIGN') return 'Projects';
    return 'Support';
  };

  const items = notifications
    .map((n) => ({ ...n, category: categoryFor(n) }))
    .filter((n) => (category ? n.category === category : true))
    .filter((n) => (onlyUnread ? !n.read : true));

  const counts: Record<string, number> = {};
  for (const n of notifications) {
    const c = categoryFor(n);
    counts[c] = (counts[c] ?? 0) + 1;
  }

  return NextResponse.json({ notifications: items, categories: [...CATEGORIES], counts, unread: notifications.filter((n) => !n.read).length });
}

const UpdateSchema = z.object({
  read: z.boolean(),
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const all: any[] = await dbClient.notification.findMany({ where: { userId: auth.user.id } });
  const targets = parsed.data.markAll ? all : all.filter((n) => parsed.data.ids?.includes(n.id));
  for (const n of targets) await dbClient.notification.update({ where: { id: n.id }, data: { read: parsed.data.read } });

  return NextResponse.json({ success: true, updated: targets.length });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const ids: string[] = body?.ids ?? [];
  const allFlag = body?.all === true;

  const mine: any[] = await dbClient.notification.findMany({ where: { userId: auth.user.id } });
  const targets = allFlag ? mine : mine.filter((n) => ids.includes(n.id));
  for (const n of targets) await dbClient.notification.delete({ where: { id: n.id } });

  return NextResponse.json({ success: true, deleted: targets.length });
}
