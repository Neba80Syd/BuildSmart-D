import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const products = await dbClient.product.findMany({ where: { vendorId } });
  const nameByProduct: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const links = await dbClient.crossSell.findMany({ where: { vendorId } });

  // Map: productId -> related product names
  const grouped: Record<string, any[]> = {};
  for (const l of links) {
    (grouped[l.productId] ??= []).push({ id: l.id, relatedProductId: l.relatedProductId, relatedName: nameByProduct[l.relatedProductId] ?? l.relatedProductId });
  }

  const assignments = products.map((p) => ({ productId: p.id, name: p.name, related: grouped[p.id] ?? [] }));
  return NextResponse.json({ assignments });
}

const SaveSchema = z.object({
  productId: z.string(),
  relatedProductIds: z.array(z.string()),
});

export async function PUT(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const products = await dbClient.product.findMany({ where: { vendorId } });
  const mine = products.find((p) => p.id === parsed.data.productId);
  if (!mine) return NextResponse.json({ error: 'Product not found or not yours' }, { status: 403 });

  // Replace the cross-sell set for this product.
  await dbClient.crossSell.deleteMany({ where: { productId: parsed.data.productId } });
  for (const relatedId of parsed.data.relatedProductIds) {
    if (relatedId === parsed.data.productId) continue;
    await dbClient.crossSell.create({ data: { vendorId, productId: parsed.data.productId, relatedProductId: relatedId } });
  }
  return NextResponse.json({ success: true });
}
