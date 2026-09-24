import { NextRequest, NextResponse } from 'next/server';
import { dbClient, getPrisma } from '@/Backend/lib/db';
import { getSessionUser } from '@/Backend/lib/auth-session';
import { initiateOrderEscrow } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const paymentMethod = body?.paymentMethod ?? 'MTN_MOMO';

    const cart: any = await dbClient.cart.findUnique({ where: { userId } });
    if (!cart) return NextResponse.json({ error: 'No cart' }, { status: 400 });

    const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
    if (!items || items.length === 0) return NextResponse.json({ error: 'Cart empty' }, { status: 400 });

    // Compute exact totals securely from database product prices
    let total = 0;
    const itemRecords: { productId: string; quantity: number; unitPrice: number; total: number }[] = [];
    for (const item of items) {
      const prod: any = await dbClient.product.findUnique({ where: { id: item.productId } });
      if (prod) {
        const lineTotal = prod.price * item.quantity;
        total += lineTotal;
        itemRecords.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: prod.price,
          total: lineTotal,
        });
      }
    }

    if (itemRecords.length === 0) {
      return NextResponse.json({ error: 'No valid items in cart' }, { status: 400 });
    }

    // Create payment record verified server-side
    const payment = await dbClient.payment.create({
      data: {
        userId,
        amount: total,
        currency: 'XAF',
        status: 'SUCCEEDED',
        description: `Marketplace Order Checkout (${paymentMethod})`,
      },
    });

    const order = await dbClient.order.create({
      data: {
        userId,
        status: 'PROCESSING',
        escrowStatus: 'ESCROWED',
        totalAmount: total,
        currency: 'XAF',
      },
    });

    for (const it of itemRecords) {
      await dbClient.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        },
      });
    }

    // Lock funds into vendor escrow
    try {
      await initiateOrderEscrow({
        orderId: order.id,
        clientId: userId,
        paymentId: payment.id,
      });
    } catch (err: any) {
      console.error('[buildsmart:orders] Escrow initiation error:', err.message);
    }

    // Clear cart
    await dbClient.cartItem.deleteMany({ where: { cartId: cart.id } });

    await dbClient.notification.create({
      data: {
        userId,
        type: 'ORDER',
        title: 'Order placed & payment secured',
        body: `Order #${order.id} is confirmed. ${total.toLocaleString()} XAF is protected in escrow while the vendor prepares fulfillment.`,
        read: false,
        link: '/client/orders',
        resourceId: order.id,
      },
    });

    return NextResponse.json({ success: true, orderId: order.id, total, paymentId: payment.id });
  } catch (err: any) {
    console.error('[buildsmart:orders:POST] Internal error:', err);
    return NextResponse.json({ error: err?.message ?? 'Checkout failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, orders: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') ?? 'user';

  // Vendors & admins may view all orders for fulfillment / oversight.
  const where = scope === 'all' && (user.role === 'VENDOR' || user.role === 'ADMIN') ? {} : { userId: user.id };
  const orders = await dbClient.order.findMany({ where });

  const prisma = await getPrisma();
  const [products, escrows, disputes] = await Promise.all([
    dbClient.product.findMany(),
    prisma.escrowTransaction.findMany({ where: { orderId: { in: orders.map((o: any) => o.id) } } }),
    prisma.dispute.findMany({ where: { orderId: { in: orders.map((o: any) => o.id) } } }),
  ]);

  const escrowByOrder = new Map(escrows.map((e: any) => [e.orderId, e]));
  const disputeByOrder = new Map(disputes.map((d: any) => [d.orderId, d]));

  const enriched = await Promise.all(
    orders.map(async (o: any) => {
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
            }
          : null,
        items: items.map((it: any) => {
          const p = products.find((x: any) => x.id === it.productId);
          return { ...it, name: p?.name ?? 'Product', unit: p?.unit ?? '' };
        }),
      };
    })
  );

  return NextResponse.json({ authenticated: true, orders: enriched });
}

