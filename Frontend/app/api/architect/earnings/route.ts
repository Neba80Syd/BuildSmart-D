import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { CURRENCY, COMMISSION_RATE } from '@/Backend/lib/architect';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const transactions: any[] = await dbClient.transaction.findMany({ where: { userId: user.id } });
  const earnings = transactions.filter((t) => t.kind === 'EARNING');
  const totalEarnings = earnings.filter((t) => t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const pending = earnings.filter((t) => t.status === 'PENDING').reduce((s: number, t: any) => s + t.amount, 0);
  const withdrawn = transactions.filter((t) => t.kind === 'WITHDRAWAL' && t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const fees = transactions.filter((t) => t.kind === 'FEE').reduce((s: number, t: any) => s + t.amount, 0);
  const available = totalEarnings - withdrawn - fees;

  return NextResponse.json({
    currency: CURRENCY,
    commissionRate: COMMISSION_RATE,
    transactions,
    totals: { totalEarnings, pending, withdrawn, fees, available },
  });
}

const WithdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['BANK', 'STRIPE']),
  account: z.record(z.string(), z.string()),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = WithdrawSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid withdrawal' }, { status: 400 });

  // Server-side validation: never trust client-side balance claims.
  const transactions: any[] = await dbClient.transaction.findMany({ where: { userId: user.id } });
  const totalEarnings = transactions.filter((t) => t.kind === 'EARNING' && t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const withdrawn = transactions.filter((t) => t.kind === 'WITHDRAWAL' && t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const available = totalEarnings - withdrawn;
  if (parsed.data.amount > available) {
    return NextResponse.json({ error: `Insufficient balance — available ${available.toLocaleString()} ${CURRENCY}` }, { status: 400 });
  }

  const withdrawal = await dbClient.transaction.create({
    data: {
      userId: user.id,
      kind: 'WITHDRAWAL',
      amount: parsed.data.amount,
      currency: CURRENCY,
      status: 'PENDING',
      description: `Withdrawal to ${parsed.data.method === 'BANK' ? 'bank' : 'Stripe'} account`,
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, type: 'PAYMENT', title: 'Withdrawal requested', body: `${parsed.data.amount.toLocaleString()} ${CURRENCY}` } });
  return NextResponse.json({ success: true, withdrawal }, { status: 201 });
}
