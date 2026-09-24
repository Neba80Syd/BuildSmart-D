import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const products: any[] = await dbClient.product.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const users: any[] = await dbClient.user.findMany();
  const vendorName = (vendorId: string) => {
    // `products.vendorId` stores the vendor *profile* id (e.g. vp_1); resolve
    // to the business name (fall back to the user name when no profile exists).
    const vp = vendors.find((v) => v.id === vendorId) || vendors.find((v) => v.userId === vendorId);
    const u = users.find((x) => x.id === vp?.userId);
    return vp?.businessName || u?.name || 'Unknown';
  };

  const list = products
    .filter((p) => (status ? p.approvalStatus === status : true))
    .filter((p) => (category ? p.category === category : true))
    .filter((p) => (q ? `${p.name ?? ''} ${p.category ?? ''} ${p.sku ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((p) => ({ ...p, vendorName: vendorName(p.vendorId) }));

  return NextResponse.json({ products: list, categories: [...new Set(products.map((p) => p.category))], statuses: ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['approve', 'reject', 'suspend', 'restore', 'flag']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const product: any = await dbClient.product.findUnique({ where: { id: parsed.data.id } });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const map: Record<string, string> = { approve: 'APPROVED', reject: 'REJECTED', suspend: 'SUSPENDED', restore: 'APPROVED', flag: 'SUSPENDED' };
  const updated = await dbClient.product.update({ where: { id: product.id }, data: { approvalStatus: map[parsed.data.action] } });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `PRODUCT_${parsed.data.action.toUpperCase()}`, resource: 'PRODUCT', resourceId: product.id, reason: parsed.data.reason ?? null });
  await notifyUser(product.vendorId, 'Listing updated by administration', `"${product.name}" was ${parsed.data.action === 'approve' ? 'approved' : parsed.data.action === 'reject' ? 'rejected' : parsed.data.action === 'suspend' || parsed.data.action === 'flag' ? 'suspended' : 'restored'}.${parsed.data.reason ? ` Reason: ${parsed.data.reason}` : ''}`);

  return NextResponse.json({ success: true, product: updated });
}
