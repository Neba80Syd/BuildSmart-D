import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// Unified finance ledger: user payments (invoices/orders) + architect transactions.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const kind = searchParams.get('kind');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const payments: any[] = await dbClient.payment.findMany();
  const transactions: any[] = await dbClient.transaction.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  const rows = [
    ...payments.map((p) => ({ id: p.id, userId: p.userId, userName: nameFor(p.userId), type: 'PAYMENT', amount: p.amount, currency: p.currency, status: p.status === 'SUCCEEDED' ? 'SUCCEEDED' : p.status, method: '—', description: p.description, createdAt: p.createdAt })),
    ...transactions.map((t) => ({ id: t.id, userId: t.userId, userName: nameFor(t.userId), type: t.kind, amount: t.amount, currency: t.currency, status: t.status, method: t.kind === 'WITHDRAWAL' ? 'BANK' : '—', description: t.description, createdAt: t.createdAt })),
  ]
    .filter((r) => (status ? r.status === status : true))
    .filter((r) => (kind ? r.type === kind : true))
    .filter((r) => (q ? `${r.id ?? ''} ${r.description ?? ''} ${r.userName ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const succeeded = rows.filter((r) => r.status === 'SUCCEEDED' && r.type !== 'WITHDRAWAL' && r.type !== 'FEE');
  const refunded = rows.filter((r) => r.type === 'REFUND');
  const summary = {
    gross: succeeded.reduce((s, r) => s + r.amount, 0),
    refunds: refunded.reduce((s, r) => s + r.amount, 0),
    net: succeeded.reduce((s, r) => s + r.amount, 0) - refunded.reduce((s, r) => s + r.amount, 0),
    pending: rows.filter((r) => r.status === 'PENDING').length,
    failed: rows.filter((r) => r.status === 'FAILED').length,
  };

  return NextResponse.json({ transactions: rows, summary, statuses: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED'], kinds: ['PAYMENT', 'EARNING', 'WITHDRAWAL', 'FEE', 'REFUND', 'SUBSCRIPTION'] });
}

const RefundSchema = z.object({
  paymentId: z.string(),
  reason: z.string().max(500).optional(),
});

// Refund a processed payment. The amount is always derived server-side from
// the stored payment record — client-supplied amounts are never trusted.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = RefundSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const all: any[] = await dbClient.payment.findMany();
  const target = all.find((p) => p.id === parsed.data.paymentId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.status !== 'SUCCEEDED') return NextResponse.json({ error: 'Only settled payments can be refunded' }, { status: 400 });

  await dbClient.transaction.create({ data: { userId: target.userId, kind: 'REFUND', amount: target.amount, currency: target.currency, status: 'SUCCEEDED', description: `Refund for ${target.id} — ${target.description}`, createdAt: new Date() } });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'REFUND_ISSUED', resource: 'PAYMENT', resourceId: target.id, reason: parsed.data.reason ?? null });
  await notifyUser(target.userId, 'Refund issued', `${target.amount.toLocaleString()} ${target.currency} refund processed for ${target.description}.`);

  return NextResponse.json({ success: true, amount: target.amount });
}
