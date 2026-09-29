import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const orders: any[] = await dbClient.order.findMany();
  const users: any[] = await dbClient.user.findMany();
  const items: any[] = await dbClient.orderItem.findMany({});
  const products: any[] = await dbClient.product.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  if (id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const orderItems = items.filter((i) => i.orderId === id).map((i) => ({ ...i, name: products.find((p) => p.id === i.productId)?.name ?? i.productId }));
    return NextResponse.json({ order: { ...o, userName: nameFor(o.userId) }, items: orderItems });
  }

  const list = orders
    .filter((o) => (status ? o.status === status : true))
    .filter((o) => (q ? `${o.id ?? ''} ${o.trackingNumber ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => ({ ...o, userName: nameFor(o.userId), itemCount: items.filter((i) => i.orderId === o.id).length }));

  return NextResponse.json({ orders: list, statuses: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['flag', 'cancel', 'refund']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const order: any = await dbClient.order.findUnique({ where: { id: parsed.data.id } });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (parsed.data.action === 'refund') {
    if (!['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PROCESSING'].includes(order.status)) return NextResponse.json({ error: 'Only active orders can be refunded' }, { status: 400 });
    // Refund amount is always the server-recorded order total.
    await dbClient.transaction.create({ data: { userId: order.userId, kind: 'REFUND', amount: order.totalAmount, currency: order.currency, status: 'SUCCEEDED', description: `Refund for ${order.id}`, createdAt: new Date() } });
    await dbClient.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    const orderInvoices: any[] = await dbClient.invoice.findMany({ where: { orderId: order.id } });
    for (const inv of orderInvoices) await dbClient.invoice.update({ where: { id: inv.id }, data: { status: 'REFUNDED' } });
  } else if (parsed.data.action === 'cancel') {
    await dbClient.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  }

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `ORDER_${parsed.data.action.toUpperCase()}`, resource: 'ORDER', resourceId: order.id, reason: parsed.data.reason ?? null });
  await notifyUser(order.userId, `Order ${parsed.data.action}ed`, `Order ${order.id} was ${parsed.data.action === 'refund' ? 'refunded' : parsed.data.action === 'cancel' ? 'cancelled' : 'flagged'} by administration.`);

  return NextResponse.json({ success: true });
}
