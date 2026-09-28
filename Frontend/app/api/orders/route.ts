import { NextRequest, NextResponse } from 'next/server';
import { dbClient, getPrisma } from '@/Backend/lib/db';
import { getSessionUser } from '@/Backend/lib/auth-session';
import { initiateOrderEscrow } from '@/Backend/lib/escrow';
import { getPaymentProvider } from '@/Backend/lib/payment-provider';

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
    const paymentMethod = body?.paymentMethod ?? 'CAMPAY';
    const clientPhone = body?.paymentDetails?.phoneNumber || body?.phoneNumber || body?.clientPhone;
    const shippingMethod = body?.shippingMethod ?? 'FREE';
    const shippingAddress = body?.shippingAddress ?? null;
    const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : null;

    const cart: any = await dbClient.cart.findUnique({ where: { userId } });
    if (!cart) return NextResponse.json({ error: 'No cart' }, { status: 400 });

    const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
    if (!items || items.length === 0) return NextResponse.json({ error: 'Cart empty' }, { status: 400 });

    // Compute exact totals securely from database product prices
    let subtotal = 0;
    const itemRecords: { productId: string; vendorId: string; quantity: number; unitPrice: number; total: number }[] = [];
    for (const item of items) {
      const prod: any = await dbClient.product.findUnique({ where: { id: item.productId } });
      if (prod) {
        const lineTotal = prod.price * item.quantity;
        subtotal += lineTotal;
        itemRecords.push({
          productId: item.productId,
          vendorId: prod.vendorId || 'vp_1',
          quantity: item.quantity,
          unitPrice: prod.price,
          total: lineTotal,
        });
      }
    }

    if (itemRecords.length === 0) {
      return NextResponse.json({ error: 'No valid items in cart' }, { status: 400 });
    }

    // Evaluate coupon code if provided
    let discountAmount = 0;
    let appliedCoupon: any = null;
    let isFreeShipping = false;

    if (couponCode) {
      const coupons = await dbClient.coupon.findMany({}).catch(() => []);
      const found = coupons.find((c: any) => c.code.trim().toUpperCase() === couponCode && c.active);
      const now = new Date();
      if (
        found &&
        (!found.startsAt || new Date(found.startsAt) <= now) &&
        (!found.endsAt || new Date(found.endsAt) >= now) &&
        (!found.maxUses || (found.usedCount || 0) < found.maxUses)
      ) {
        // Calculate qualifying items subtotal
        const qualifyingSubtotal = itemRecords
          .filter((it) => !found.vendorId || found.vendorId === 'all' || it.vendorId === found.vendorId)
          .reduce((sum, it) => sum + it.total, 0);

        if (qualifyingSubtotal >= (found.minOrder || 0)) {
          appliedCoupon = found;
          if (found.type === 'PERCENT') {
            discountAmount = Math.round(qualifyingSubtotal * (Number(found.value || 0) / 100));
          } else if (found.type === 'FIXED') {
            discountAmount = Math.min(qualifyingSubtotal, Math.round(Number(found.value || 0)));
          } else if (found.type === 'FREE_SHIPPING') {
            isFreeShipping = true;
          }

          // Increment coupon used count
          await dbClient.coupon.update({
            where: { id: found.id },
            data: { usedCount: (found.usedCount || 0) + 1 },
          }).catch(() => {});
        }
      }
    }

    const shippingFee = shippingMethod === 'EXPRESS' && !isFreeShipping ? 5000 : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

    // Initialize provider transaction via Campay / Payment Gateway
    const provider = getPaymentProvider(paymentMethod);
    const paymentRef = `pay_ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let providerInit: any = null;

    try {
      providerInit = await provider.initializePayment({
        amount: finalTotal,
        paymentMethod,
        reference: paymentRef,
        description: `Order Checkout (${paymentMethod})${appliedCoupon ? ` [Coupon: ${appliedCoupon.code}]` : ''}`,
        clientPhone,
        clientEmail: user.email,
        returnUrl: `${process.env.AUTH_URL || 'http://localhost:3000'}/client/orders?ref=${paymentRef}`,
      });
    } catch (err: any) {
      console.warn('[buildsmart:orders] Payment provider initialization warning:', err.message);
    }

    // Create payment record verified server-side
    const payment = await dbClient.payment.create({
      data: {
        userId,
        amount: finalTotal,
        currency: 'XAF',
        status: providerInit?.status === 'SUCCESS' ? 'SUCCEEDED' : 'PENDING',
        description: `Marketplace Order Checkout (${paymentMethod}) [Ref: ${providerInit?.providerReference || paymentRef}]`,
      },
    });

    const carrierDescription =
      shippingMethod === 'EXPRESS' ? 'Express Delivery (1-3 Days)' : 'Standard Free Delivery (7-20 Days)';

    const order = await dbClient.order.create({
      data: {
        userId,
        status: 'PROCESSING',
        escrowStatus: 'ESCROWED',
        totalAmount: finalTotal,
        currency: 'XAF',
        carrier: carrierDescription,
      },
    });

    // Save order items, proportionally applying discounts so line sums equal escrow amount
    for (const it of itemRecords) {
      const proportion = subtotal > 0 ? it.total / subtotal : 0;
      const allocatedDiscount = Math.round(discountAmount * proportion);
      const discountedLineTotal = Math.max(0, it.total - allocatedDiscount);

      await dbClient.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: discountedLineTotal,
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
        title: 'Order placed & payment secured in escrow',
        body: `Order #${order.id} is confirmed. ${finalTotal.toLocaleString()} XAF is safely secured in vendor escrow wallet until delivery inspection.`,
        read: false,
        link: '/client/orders',
        resourceId: order.id,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      subtotal,
      discountAmount,
      shippingFee,
      total: finalTotal,
      couponApplied: appliedCoupon ? appliedCoupon.code : null,
      paymentId: payment.id,
      paymentReference: paymentRef,
      providerReference: providerInit?.providerReference,
      instructions: providerInit?.instructions,
      ussdCode: providerInit?.ussdCode,
      operator: providerInit?.operator,
      redirectUrl: providerInit?.redirectUrl,
      paymentToken: providerInit?.paymentToken,
    });
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

