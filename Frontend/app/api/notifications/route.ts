import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export async function GET() {
  const user = await resolveUser();
  const items = await dbClient.notification.findMany({ where: { userId: user.id } });
  const unread = items.filter((n: any) => !n.read).length;
  return NextResponse.json({ notifications: items, unread });
}

const PatchSchema = z.object({
  read: z.boolean(),
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser();
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { read, ids, markAll } = body.data;
  const all = await dbClient.notification.findMany({ where: { userId: user.id } });

  const targets = markAll
    ? all
    : all.filter((n: any) => (ids ?? []).includes(n.id));

  for (const n of targets) {
    await dbClient.notification.update({ where: { id: n.id }, data: { read } });
  }
  return NextResponse.json({ success: true });
}
