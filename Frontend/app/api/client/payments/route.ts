import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const payments: any[] = await dbClient.payment.findMany({ where: { userId: user.id } });
  const invoices: any[] = await dbClient.invoice.findMany({ where: { userId: user.id } });
  const transactions: any[] = await dbClient.transaction.findMany({ where: { userId: user.id } });
  const projects = await getClientProjects(user.id);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  const summary = {
    pending: invoices.filter((i) => i.status === 'PENDING').reduce((s, i) => s + (i.total ?? 0), 0),
    paid: payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + (p.amount ?? 0), 0),
    refunded: payments.filter((p) => p.status === 'REFUNDED').reduce((s, p) => s + (p.amount ?? 0), 0),
    failed: payments.filter((p) => p.status === 'FAILED').length,
  };

  return NextResponse.json({
    payments,
    invoices: invoices.map((i) => ({ ...i, projectName: projName(i.projectId) })),
    transactions,
    summary,
  });
}

// Make a payment against an invoice. The amount is always taken server-side
// from the invoice total — the client can never supply a payment amount.
const PaySchema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']).default('CARD'),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = PaySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const invoice: any = await dbClient.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!invoice || invoice.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });

  // Simulate settlement with the server-computed amount.
  const payment = await dbClient.payment.create({
    data: {
      userId: user.id,
      subscriptionId: null,
      amount: invoice.total,
      currency: invoice.currency,
      status: 'SUCCEEDED',
      description: `${invoice.number} — ${invoice.description ?? 'Invoice payment'} (${parsed.data.method})`,
    },
  });
  await dbClient.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
  await dbClient.notification.create({ data: { userId: user.id, type: 'PAYMENT', title: 'Payment successful', body: `Invoice ${invoice.number} was paid (${invoice.total.toLocaleString()} ${invoice.currency}).`, read: 0, link: '/client/payments', resourceId: invoice.id } });
  await dbClient.activity.create({ data: { userId: user.id, projectId: invoice.projectId, type: 'PAYMENT', title: 'Payment made', body: `${invoice.number} — ${invoice.total.toLocaleString()} ${invoice.currency}` } });

  return NextResponse.json({ success: true, payment, invoice: { ...invoice, status: 'PAID' } }, { status: 201 });
}
