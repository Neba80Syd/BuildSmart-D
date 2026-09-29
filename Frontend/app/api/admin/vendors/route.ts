import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const users: any[] = await dbClient.user.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const products: any[] = await dbClient.product.findMany();
  const orderItems: any[] = await dbClient.orderItem.findMany({});
  const reviews: any[] = await dbClient.review.findMany();
  const reports: any[] = await dbClient.report.findMany();

  const vendorUsers = users.filter((u) => u.role === 'VENDOR');
  const prodVendor = new Map(products.map((p) => [p.id, p.vendorId]));

  const list = vendorUsers
    .map((u) => {
      const vp = vendors.find((v) => v.userId === u.id);
      const vendorProducts = products.filter((p) => p.vendorId === vp?.id);
      const vendorReviews = reviews.filter((r) => r.targetType === 'VENDOR' && (r.targetId === vp?.id || r.targetId === u.id));
      const orderIds = new Set(orderItems.filter((i) => prodVendor.get(i.productId) === vp?.id).map((i) => i.orderId));
      return {
        id: u.id,
        name: vp?.businessName || u.name,
        email: u.email,
        status: u.status ?? 'ACTIVE',
        verificationStatus: vp?.verificationStatus ?? 'UNVERIFIED',
        productCount: vendorProducts.length,
        activeListings: vendorProducts.filter((p) => p.isActive).length,
        rating: vp?.rating ?? 0,
        reviewCount: vendorReviews.length,
        complaints: reports.filter((r) => r.targetType === 'VENDOR' && (r.targetId === vp?.id || r.targetId === u.id)).length,
        orderCount: orderIds.size,
      };
    })
    .filter((v) => (q ? `${v.name ?? ''} ${v.email ?? ''}`.toLowerCase().includes(q) : true));

  return NextResponse.json({ vendors: list });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['suspend', 'restore', 'verify']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const target: any = await dbClient.user.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.role !== 'VENDOR') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.action === 'suspend') data.status = 'SUSPENDED';
  if (parsed.data.action === 'restore') data.status = 'ACTIVE';
  if (parsed.data.action === 'verify') {
    await dbClient.vendorProfile.update({ where: { userId: target.id }, data: { verificationStatus: 'FULLY_VERIFIED', verifiedAt: new Date().toISOString() } });
  } else {
    await dbClient.user.update({ where: { id: target.id }, data });
  }

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `VENDOR_${parsed.data.action.toUpperCase()}`, resource: 'VENDOR', resourceId: target.id, reason: parsed.data.reason ?? null });
  await notifyUser(target.id, 'Account status updated', `An administrator ${parsed.data.action === 'suspend' ? 'suspended' : parsed.data.action === 'verify' ? 'verified' : 'restored'} your account.`);

  return NextResponse.json({ success: true });
}
