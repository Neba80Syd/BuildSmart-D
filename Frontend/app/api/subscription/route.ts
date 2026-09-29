import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

const PLANS = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'] as const;
const PLAN_PRICES: Record<string, number> = { FREE: 0, BASIC: 19, PROFESSIONAL: 49, ENTERPRISE: 199 };

const ChangeSchema = z.object({ plan: z.enum(PLANS) });

export async function GET() {
  const user = await resolveUser();
  const subscription = await dbClient.subscription.findUnique({ where: { userId: user.id } });
  const payments = await dbClient.payment.findMany({ where: { userId: user.id } });
  return NextResponse.json({ subscription, payments, planPrices: PLAN_PRICES });
}

export async function POST(req: NextRequest) {
  const user = await resolveUser();
  const parsed = ChangeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const plan = parsed.data.plan;
  const existing = await dbClient.subscription.findUnique({ where: { userId: user.id } });

  if (plan === 'FREE') {
    const sub = existing
      ? await dbClient.subscription.update({ where: { userId: user.id }, data: { plan, status: 'CANCELED' } })
      : await dbClient.subscription.create({ data: { userId: user.id, plan, status: 'CANCELED', startedAt: new Date().toISOString(), renewsAt: null } });
    return NextResponse.json({ success: true, subscription: sub });
  }

  const data = {
    userId: user.id,
    plan,
    status: 'ACTIVE',
    startedAt: existing?.startedAt ?? new Date().toISOString(),
    renewsAt: new Date(Date.now() + 30 * 864e5).toISOString(),
  };
  const subscription = existing
    ? await dbClient.subscription.update({ where: { userId: user.id }, data: { plan, status: 'ACTIVE', renewsAt: data.renewsAt } })
    : await dbClient.subscription.create({ data });

  const price = PLAN_PRICES[plan] ?? 0;
  if (price > 0) {
    await dbClient.payment.create({
      data: { userId: user.id, subscriptionId: subscription.id, amount: price, currency: 'EUR', status: 'SUCCEEDED', description: `${plan} plan — monthly` },
    });
  }
  return NextResponse.json({ success: true, subscription });
}
