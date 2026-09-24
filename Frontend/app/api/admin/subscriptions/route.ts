import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const subscriptions: any[] = await dbClient.subscription.findMany();
  const users: any[] = await dbClient.user.findMany();
  const planSetting: any = await dbClient.platformSetting.findUnique({ where: { key: 'subscriptionPlans' } });
  const plans = parseJson(planSetting?.value, []);
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  return NextResponse.json({
    plans,
    subscriptions: subscriptions.map((s) => ({ ...s, userName: nameFor(s.userId), userRole: users.find((u) => u.id === s.userId)?.role ?? 'CLIENT' })),
  });
}

const UpdateSchema = z.object({
  id: z.string(),
  plan: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'PAST_DUE']).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.subscription.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.plan) data.plan = parsed.data.plan;
  if (parsed.data.status) data.status = parsed.data.status;

  const updated = await dbClient.subscription.update({ where: { id: existing.id }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'SUBSCRIPTION_UPDATED', resource: 'SUBSCRIPTION', resourceId: existing.id, reason: `${parsed.data.plan ?? ''} ${parsed.data.status ?? ''}` });
  await notifyUser(existing.userId, 'Subscription updated', `Your plan was updated to ${updated.plan} (${updated.status}).`);

  return NextResponse.json({ success: true, subscription: updated });
}
