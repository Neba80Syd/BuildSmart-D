import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const invoices: any[] = await dbClient.invoice.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  const list = invoices
    .filter((i) => (status ? i.status === status : true))
    .filter((i) => (q ? `${i.number ?? ''} ${i.description ?? ''}`.toLowerCase().includes(q) : true))
    .map((i) => ({ ...i, userName: nameFor(i.userId) }));

  const summary = {
    total: list.reduce((s, i) => s + i.total, 0),
    paid: list.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.total, 0),
    pending: list.filter((i) => i.status === 'PENDING').reduce((s, i) => s + i.total, 0),
    refunded: list.filter((i) => i.status === 'REFUNDED').reduce((s, i) => s + i.total, 0),
  };

  return NextResponse.json({ invoices: list, summary, statuses: ['PENDING', 'PAID', 'REFUNDED'] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['void', 'mark_paid']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const invoice: any = await dbClient.invoice.findUnique({ where: { id: parsed.data.id } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await dbClient.invoice.update({ where: { id: invoice.id }, data: { status: parsed.data.action === 'void' ? 'REFUNDED' : 'PAID' } });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `INVOICE_${parsed.data.action.toUpperCase()}`, resource: 'INVOICE', resourceId: invoice.id, reason: parsed.data.reason ?? null });

  return NextResponse.json({ success: true, invoice: updated });
}
