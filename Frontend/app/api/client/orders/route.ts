import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient, getPrisma } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { confirmDelivery, openDispute } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const orders: any[] = await dbClient.order.findMany({ where: { userId: user.id } });
  const prisma = await getPrisma();
  const orderIds = orders.map((o) => o.id);

  const [products, vendors, escrows, disputes] = await Promise.all([
    dbClient.product.findMany(),
    dbClient.vendorProfile.findMany(),
    prisma.escrowTransaction.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.dispute.findMany({ where: { orderId: { in: orderIds } } }),
  ]);

  const escrowByOrder = new Map(escrows.map((e: any) => [e.orderId, e]));
  const disputeByOrder = new Map(disputes.map((d: any) => [d.orderId, d]));

  const enriched = await Promise.all(
    orders.map(async (o) => {
      const items: any[] = await dbClient.orderItem.findMany({ where: { orderId: o.id } });
      const esc: any = escrowByOrder.get(o.id);
      const disp: any = disputeByOrder.get(o.id);

      return {
        ...o,
        escrowStatus: esc?.status ?? o.escrowStatus ?? 'ESCROWED',
        confirmationDeadline: esc?.confirmationDeadline ?? o.confirmationDeadline ?? null,
        escrowAmount: esc?.amount ?? o.totalAmount,
        dispute: disp
          ? {
              id: disp.id,
              status: disp.status,
              reason: disp.reason,
              description: disp.description,
              vendorResponse: disp.vendorResponse,
              timeline: disp.timeline,
            }
          : null,
        items: items.map((it) => {
          const p = products.find((x) => x.id === it.productId);
          return {
            ...it,
            name: p?.name ?? 'Product',
            unit: p?.unit ?? '',
            vendorId: p?.vendorId,
            vendorName: vendors.find((v) => v.userId === p?.vendorId || v.id === p?.vendorId)?.businessName ?? 'Verified Vendor',
          };
        }),
      };
    })
  );

  return NextResponse.json({ orders: enriched });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['cancel', 'confirm_delivery', 'open_dispute', 'report']),
  reason: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  note: z.string().max(1000).optional(),
  evidence: z.array(z.any()).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.order.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, reason, description, note, evidence } = parsed.data;

  if (action === 'cancel') {
    if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(existing.status)) {
      return NextResponse.json({ error: 'Order can no longer be cancelled once shipped or delivered' }, { status: 400 });
    }
    const order = await dbClient.order.update({ where: { id: existing.id }, data: { status: 'CANCELLED', escrowStatus: 'CANCELLED' } });
    await dbClient.notification.create({
      data: {
        userId: user.id,
        type: 'ORDER',
        title: 'Order cancelled',
        body: `Order ${existing.id} was cancelled.`,
        read: 0,
        link: '/client/orders',
        resourceId: existing.id,
      },
    });
    return NextResponse.json({ success: true, order });
  }

  if (action === 'confirm_delivery') {
    try {
      const result = await confirmDelivery({
        orderId: existing.id,
        clientId: user.id,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Confirmation failed' }, { status: 400 });
    }
  }

  if (action === 'open_dispute') {
    try {
      const result = await openDispute({
        orderId: existing.id,
        clientId: user.id,
        reason: reason ?? 'DELIVERY_PROBLEM',
        description: description ?? note ?? 'Client reported an issue with this delivered order.',
        evidence,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Dispute creation failed' }, { status: 400 });
    }
  }

  if (action === 'report') {
    // Backward compatibility fallback to support ticket
    const ticket = await dbClient.supportTicket.create({
      data: {
        userId: user.id,
        subject: `Problem with order ${existing.id}`,
        category: 'Orders',
        status: 'OPEN',
        priority: 'MEDIUM',
        description: note ?? 'The client reported a problem with this order.',
      },
    });
    return NextResponse.json({ success: true, ticket });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
