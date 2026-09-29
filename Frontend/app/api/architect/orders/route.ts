import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getSessionUser } from '@/Backend/lib/auth-session';

export const dynamic = 'force-dynamic';

async function enrichOrders(userId: string) {
  const orders: any[] = await dbClient.order.findMany({ where: { userId } });
  const products: any[] = await dbClient.product.findMany();
  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? 'Product';
  const enriched = await Promise.all(
    orders.map(async (o) => {
      const items: any[] = await dbClient.orderItem.findMany({ where: { orderId: o.id } });
      return { ...o, items: items.map((i) => ({ ...i, name: prodName(i.productId) })) };
    })
  );
  return enriched;
}

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const orders = await enrichOrders(user.id);
  return NextResponse.json({ orders });
}

export async function POST() {
  // Purchasing requires a real signed-in architect; the demo fallback only
  // applies to read-only preview dashboards.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, error: 'Authentication required' }, { status: 401 });
  }
  if (user.role !== 'ARCHITECT') {
    return NextResponse.json({ error: 'Architect access required' }, { status: 403 });
  }

  const cart: any = await dbClient.cart.findUnique({ where: { userId: user.id } });
  if (!cart) return NextResponse.json({ error: 'No cart' }, { status: 400 });
  const items: any[] = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
  if (items.length === 0) return NextResponse.json({ error: 'Cart empty' }, { status: 400 });

  let total = 0;
  for (const item of items) {
    const prod: any = await dbClient.product.findUnique({ where: { id: item.productId } });
    if (prod) total += prod.price * item.quantity;
  }
  // Server recomputes and validates the order total.
  const order = await dbClient.order.create({ data: { userId: user.id, status: 'PENDING', totalAmount: total, currency: 'XAF' } });
  for (const item of items) {
    const prod: any = await dbClient.product.findUnique({ where: { id: item.productId } });
    if (prod) {
      await dbClient.orderItem.create({ data: { orderId: order.id, productId: item.productId, quantity: item.quantity, unitPrice: prod.price, total: prod.price * item.quantity } });
    }
  }
  await dbClient.cartItem.deleteMany({ where: { cartId: cart.id } });
  await dbClient.notification.create({ data: { userId: user.id, type: 'ORDER', title: 'Order placed', body: `Order ${order.id} confirmed (${total.toLocaleString()} XAF).`, read: 0 } });
  await dbClient.activity.create({ data: { userId: user.id, type: 'ORDER', title: 'New order placed', body: `Order ${order.id} (${total.toLocaleString()} XAF).` } });
  return NextResponse.json({ success: true, orderId: order.id, total });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['CANCEL', 'CONFIRM_RECEIPT']),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const order: any = await dbClient.order.findUnique({ where: { id: parsed.data.id } });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (order.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (parsed.data.action === 'CANCEL') {
    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
      return NextResponse.json({ error: 'This order can no longer be cancelled' }, { status: 400 });
    }
    const updated = await dbClient.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, order: updated });
  }
  if (parsed.data.action === 'CONFIRM_RECEIPT') {
    if (order.status !== 'SHIPPED') return NextResponse.json({ error: 'Order is not shipped yet' }, { status: 400 });
    const updated = await dbClient.order.update({ where: { id: order.id }, data: { status: 'DELIVERED', fulfilledAt: new Date() } });
    return NextResponse.json({ success: true, order: updated });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
