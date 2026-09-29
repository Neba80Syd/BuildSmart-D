import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

const BulkProductSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  category: z.string().min(1).max(60),
  unit: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  certifications: z.string().max(200).optional(),
  sku: z.string().max(80).optional(),
  barcode: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).optional(),
  backorderable: z.boolean().optional(),
});

const BulkSchema = z.object({ products: z.array(BulkProductSchema).min(1).max(50) });

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = BulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload — expected { products: [...] }' }, { status: 400 });

  const created: any[] = [];
  for (const p of parsed.data.products) {
    const product = await dbClient.product.create({
      data: {
        ...p,
        vendorId: user.id,
        description: p.description ?? `${p.name} — professional grade`,
        imageUrl: '/images/product-cement.png',
        isActive: 1,
      },
    });
    created.push(product);
  }
  return NextResponse.json({ success: true, created }, { status: 201 });
}

const BulkDeleteSchema = z.object({ ids: z.array(z.string()).min(1) });

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = BulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload — expected { ids: [...] }' }, { status: 400 });

  let deleted = 0;
  for (const id of parsed.data.ids) {
    const existing = await dbClient.product.findUnique({ where: { id } });
    if (!existing || (existing.vendorId !== user.id && user.role !== 'ADMIN')) continue;
    await dbClient.product.delete({ where: { id } });
    deleted++;
  }
  return NextResponse.json({ success: true, deleted });
}
