import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const coupons = await dbClient.coupon.findMany({ where: { vendorId } });
  return NextResponse.json({ coupons });
}

const CouponSchema = z.object({
  code: z.string().min(3).max(40).transform((s) => s.toUpperCase()),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
  value: z.number().nonnegative(),
  minOrder: z.number().nonnegative().default(0),
  maxUses: z.number().int().nonnegative().default(0),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = CouponSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid coupon' }, { status: 400 });

  const existing = await dbClient.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });

  const coupon = await dbClient.coupon.create({
    data: {
      vendorId,
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });
  return NextResponse.json({ success: true, coupon }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  active: z.boolean().optional(),
  maxUses: z.number().int().nonnegative().optional(),
  value: z.number().nonnegative().optional(),
  endsAt: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const coupons = await dbClient.coupon.findMany({ where: { vendorId } });
  const coupon = coupons.find((c) => c.id === parsed.data.id);
  if (!coupon) return NextResponse.json({ error: 'Coupon not found or not yours' }, { status: 404 });

  const { id, endsAt, ...fields } = parsed.data;
  const couponUpd = await dbClient.coupon.update({
    where: { id },
    data: { ...fields, ...(endsAt ? { endsAt: new Date(endsAt) } : {}) },
  });
  return NextResponse.json({ success: true, coupon: couponUpd });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const coupons = await dbClient.coupon.findMany({ where: { vendorId } });
  if (!coupons.find((c) => c.id === id)) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  await dbClient.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
