import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// Read-only financial reporting. All figures are computed server-side from
// stored payments / transactions — never from the browser.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const range = Number(new URL(req.url).searchParams.get('range') ?? 90) || 90;
  const cutoff = Date.now() - range * 86400000;

  const payments: any[] = await dbClient.payment.findMany();
  const transactions: any[] = await dbClient.transaction.findMany();
  const invoices: any[] = await dbClient.invoice.findMany();
  const orders: any[] = await dbClient.order.findMany();

  const inRange = (r: any) => new Date(r.createdAt).getTime() >= cutoff;

  const succeeded = payments.filter((p) => p.status === 'SUCCEEDED' && inRange(p));
  const refunds = transactions.filter((t) => t.kind === 'REFUND' && inRange(t));
  const fees = transactions.filter((t) => t.kind === 'FEE' && inRange(t));
  const subs = transactions.filter((t) => t.kind === 'SUBSCRIPTION' && inRange(t));
  const withdrawals = transactions.filter((t) => t.kind === 'WITHDRAWAL' && inRange(t));

  const grossRevenue = succeeded.reduce((s, p) => s + p.amount, 0);
  const refundTotal = refunds.reduce((s, t) => s + t.amount, 0);
  const platformRevenue = fees.reduce((s, t) => s + t.amount, 0);
  const subscriptionRevenue = subs.reduce((s, t) => s + t.amount, 0);

  // Monthly buckets for the trend chart.
  const monthly: Record<string, { gross: number; refunds: number; net: number }> = {};
  const bump = (key: string, gross = 0, refund = 0) => {
    if (!monthly[key]) monthly[key] = { gross: 0, refunds: 0, net: 0 };
    monthly[key].gross += gross;
    monthly[key].refunds += refund;
    monthly[key].net = monthly[key].gross - monthly[key].refunds;
  };
  for (const p of succeeded) bump(new Date(p.createdAt).toLocaleDateString('en', { month: 'short', year: '2-digit' }), p.amount, 0);
  for (const t of refunds) bump(new Date(t.createdAt).toLocaleDateString('en', { month: 'short', year: '2-digit' }), 0, t.amount);

  return NextResponse.json({
    summary: {
      grossRevenue,
      platformRevenue,
      subscriptionRevenue,
      refundTotal,
      netRevenue: grossRevenue - refundTotal,
      pendingInvoices: invoices.filter((i) => i.status === 'PENDING').length,
      pendingInvoiceTotal: invoices.filter((i) => i.status === 'PENDING').reduce((s, i) => s + i.total, 0),
      orderCount: orders.filter((o) => inRange(o)).length,
      withdrawalTotal: withdrawals.reduce((s, t) => s + t.amount, 0),
      withdrawalPending: withdrawals.filter((t) => t.status === 'PENDING').reduce((s, t) => s + t.amount, 0),
    },
    monthly: Object.entries(monthly).map(([label, v]) => ({ label, ...v })),
    note: 'Estimated figures are derived from recorded payments and transactions.',
  });
}
