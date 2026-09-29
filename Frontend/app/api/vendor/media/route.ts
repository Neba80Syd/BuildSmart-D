import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const productId = new URL(req.url).searchParams.get('productId');

  const media = await dbClient.productMedia.findMany({ where: productId ? { vendorId, productId } : { vendorId } });

  // Attach product names for readability.
  const products = await dbClient.product.findMany({ where: { vendorId } });
  const nameByProduct: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));
  return NextResponse.json({ media: media.map((m) => ({ ...m, productName: nameByProduct[m.productId] ?? m.productId })) });
}

const CreateSchema = z.object({
  productId: z.string(),
  kind: z.enum(['image', 'video', 'sizechart']),
  url: z.string().min(1).max(400),
  name: z.string().max(160).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const product = await dbClient.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || product.vendorId !== vendorId) return NextResponse.json({ error: 'Product not found or not yours' }, { status: 403 });

  // Determine position (append after existing items).
  const existing = await dbClient.productMedia.findMany({ where: { productId: parsed.data.productId } });
  const media = await dbClient.productMedia.create({
    data: { vendorId, ...parsed.data, position: existing.length },
  });
  return NextResponse.json({ success: true, media }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const media = await dbClient.productMedia.findMany({ where: { vendorId } });
  const target = media.find((m) => m.id === id);
  if (!target) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  await dbClient.productMedia.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
