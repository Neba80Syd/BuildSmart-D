import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { getSessionUser } from '@/Backend/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!rawCode) {
      return NextResponse.json({ valid: false, error: 'Please enter a coupon code' }, { status: 400 });
    }

    // Retrieve all coupons to perform case-insensitive match
    let allCoupons: any[] = [];
    try {
      allCoupons = await dbClient.coupon.findMany({});
    } catch (e: any) {
      console.warn('[buildsmart:coupons] Failed to query coupons:', e.message);
    }

    // Seed default vendor demo coupons if database has none
    if (allCoupons.length === 0) {
      try {
        const demoCoupons = [
          {
            id: 'coup_summer10',
            vendorId: 'vp_1',
            code: 'SUMMER10',
            type: 'PERCENT',
            value: 10,
            minOrder: 1000,
            maxUses: 100,
            usedCount: 0,
            active: true,
            createdAt: new Date(),
          },
          {
            id: 'coup_build20',
            vendorId: 'vp_1',
            code: 'BUILD20',
            type: 'PERCENT',
            value: 20,
            minOrder: 5000,
            maxUses: 50,
            usedCount: 0,
            active: true,
            createdAt: new Date(),
          },
          {
            id: 'coup_save5000',
            vendorId: 'vp_1',
            code: 'SAVE5000',
            type: 'FIXED',
            value: 5000,
            minOrder: 10000,
            maxUses: 50,
            usedCount: 0,
            active: true,
            createdAt: new Date(),
          },
          {
            id: 'coup_freeship',
            vendorId: 'vp_1',
            code: 'FREESHIP',
            type: 'FREE_SHIPPING',
            value: 0,
            minOrder: 0,
            maxUses: 200,
            usedCount: 0,
            active: true,
            createdAt: new Date(),
          },
        ];
        for (const dc of demoCoupons) {
          await dbClient.coupon.create({ data: dc }).catch(() => {});
        }
        allCoupons = await dbClient.coupon.findMany({}).catch(() => demoCoupons);
      } catch {
        // Fallback
      }
    }

    const coupon = allCoupons.find((c: any) => c.code.trim().toUpperCase() === rawCode);

    if (!coupon) {
      return NextResponse.json(
        { valid: false, error: `Coupon code "${rawCode}" is invalid or does not exist.` },
        { status: 404 }
      );
    }

    if (!coupon.active) {
      return NextResponse.json(
        { valid: false, error: `Coupon "${coupon.code}" is currently inactive.` },
        { status: 400 }
      );
    }

    const now = new Date();
    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      return NextResponse.json(
        { valid: false, error: `Coupon "${coupon.code}" is not active yet.` },
        { status: 400 }
      );
    }

    if (coupon.endsAt && new Date(coupon.endsAt) < now) {
      return NextResponse.json(
        { valid: false, error: `Coupon "${coupon.code}" has expired.` },
        { status: 400 }
      );
    }

    if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) {
      return NextResponse.json(
        { valid: false, error: `Coupon "${coupon.code}" has reached its maximum usage limit.` },
        { status: 400 }
      );
    }

    // Now validate against cart items
    const user = await getSessionUser();
    let cartItems: any[] = [];
    if (user) {
      const cart: any = await dbClient.cart.findUnique({ where: { userId: user.id } }).catch(() => null);
      if (cart) {
        cartItems = await dbClient.cartItem.findMany({ where: { cartId: cart.id } }).catch(() => []);
      }
    }

    // Also accept items passed directly in the body as fallback
    if (cartItems.length === 0 && Array.isArray(body?.items) && body.items.length > 0) {
      cartItems = body.items;
    }

    let applicableSubtotal = 0;
    let totalSubtotal = 0;
    let matchingProductCount = 0;

    for (const item of cartItems) {
      const itemPrice = Number(item.price || 0);
      const itemQty = Number(item.quantity || 1);
      const lineTotal = itemPrice * itemQty;
      totalSubtotal += lineTotal;

      // Check if product belongs to the coupon's vendor or if platform coupon
      const isVendorMatch = !coupon.vendorId || coupon.vendorId === 'all' || item.vendorId === coupon.vendorId || !item.vendorId;
      if (isVendorMatch) {
        applicableSubtotal += lineTotal;
        matchingProductCount++;
      }
    }

    if (cartItems.length > 0 && matchingProductCount === 0) {
      return NextResponse.json(
        { valid: false, error: `This coupon is issued by a vendor whose products are not currently in your cart.` },
        { status: 400 }
      );
    }

    const minRequired = Number(coupon.minOrder || 0);
    const basisSubtotal = applicableSubtotal > 0 ? applicableSubtotal : totalSubtotal;

    if (minRequired > 0 && basisSubtotal < minRequired) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum order of ${minRequired.toLocaleString()} XAF required to use coupon "${coupon.code}". (Current qualifying items: ${basisSubtotal.toLocaleString()} XAF)`,
        },
        { status: 400 }
      );
    }

    // Calculate discount amount
    let discountAmount = 0;
    let isFreeShipping = false;

    if (coupon.type === 'PERCENT') {
      discountAmount = Math.round(basisSubtotal * (Number(coupon.value || 0) / 100));
    } else if (coupon.type === 'FIXED') {
      discountAmount = Math.min(basisSubtotal, Math.round(Number(coupon.value || 0)));
    } else if (coupon.type === 'FREE_SHIPPING') {
      isFreeShipping = true;
      discountAmount = 0;
    }

    const discountSummary =
      coupon.type === 'PERCENT'
        ? `${coupon.value}% OFF`
        : coupon.type === 'FIXED'
        ? `${Number(coupon.value).toLocaleString()} XAF OFF`
        : 'Free Shipping';

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        vendorId: coupon.vendorId,
        minOrder: coupon.minOrder,
      },
      discount: discountAmount,
      isFreeShipping,
      summary: discountSummary,
      message: `Coupon "${coupon.code}" applied! You save ${discountSummary}.`,
    });
  } catch (err: any) {
    console.error('[buildsmart:coupons:validate] Error:', err);
    return NextResponse.json(
      { valid: false, error: err?.message || 'Failed to validate coupon code' },
      { status: 500 }
    );
  }
}
