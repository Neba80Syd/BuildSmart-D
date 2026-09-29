import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient, getPrisma } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext, getVendorOrders } from '@/Backend/lib/vendor';
import { markOrderDelivered } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

async function enrich(orders: any[]) {
  const prisma = await getPrisma();
  const orderIds = orders.map((o) => o.id);

  const [users, userProfiles, escrows, disputes] = await Promise.all([
    dbClient.user.findMany(),
    dbClient.userProfile.findMany(),
    prisma.escrowTransaction.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.dispute.findMany({ where: { orderId: { in: orderIds } } }),
  ]);

  const nameByUser: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name ?? 'Client']));
  const locByUser: Record<string, string> = Object.fromEntries(userProfiles.map((p) => [p.userId, p.location ?? '']));
  const escrowByOrder = new Map(escrows.map((e: any) => [e.orderId, e]));
  const disputeByOrder = new Map(disputes.map((d: any) => [d.orderId, d]));

  return orders.map((o) => {
    const esc: any = escrowByOrder.get(o.id);
    const disp: any = disputeByOrder.get(o.id);

    return {
      ...o,
      customerName: nameByUser[o.userId] ?? 'Client',
      customerLocation: locByUser[o.userId] ?? '',
      escrowStatus: esc?.status ?? o.escrowStatus ?? 'ESCROWED',
      escrowAmount: esc?.amount ?? o.totalAmount,
      confirmationDeadline: esc?.confirmationDeadline ?? o.confirmationDeadline ?? null,
      dispute: disp
        ? {
            id: disp.id,
            status: disp.status,
            reason: disp.reason,
            description: disp.description,
            vendorResponse: disp.vendorResponse,
          }
        : null,
    };
  });
}

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const orders = await getVendorOrders(vendorId);
  return NextResponse.json({ orders: await enrich(orders) });
}

const UpdateSchema = z.object({
  id: z.string(),
  status: z.enum(ORDER_STATUSES).optional(),
  carrier: z.string().max(120).optional(),
  trackingNumber: z.string().max(160).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const orders = await getVendorOrders(vendorId);
  const order = orders.find((o) => o.id === parsed.data.id);
  if (!order) return NextResponse.json({ error: 'Order not found or not yours' }, { status: 404 });

  // If vendor is marking the order DELIVERED, invoke the escrow delivery countdown
  if (parsed.data.status === 'DELIVERED') {
    try {
      const { escrow, deadline } = await markOrderDelivered({
        orderId: order.id,
        vendorId,
      });

      const data: Record<string, any> = {
        status: 'DELIVERED',
        fulfilledAt: new Date(),
        escrowStatus: 'CLIENT_CONFIRMATION_PENDING',
        confirmationDeadline: deadline,
      };
      if (parsed.data.carrier !== undefined) data.carrier = parsed.data.carrier;
      if (parsed.data.trackingNumber !== undefined) data.trackingNumber = parsed.data.trackingNumber;

      const updated = await dbClient.order.update({ where: { id: order.id }, data });
      return NextResponse.json({ success: true, order: updated, escrow });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Could not mark order delivered' }, { status: 400 });
    }
  }

  const data: Record<string, any> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.carrier !== undefined) data.carrier = parsed.data.carrier;
  if (parsed.data.trackingNumber !== undefined) data.trackingNumber = parsed.data.trackingNumber;

  if (parsed.data.status === 'SHIPPED' && !order.shippedAt) data.shippedAt = new Date();

  const updated = await dbClient.order.update({ where: { id: order.id }, data });
  return NextResponse.json({ success: true, order: updated });
}

