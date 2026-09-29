import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

function withVendor(p: any, profiles: any[]) {
  const vp = profiles.find((v: any) => v.userId === p.vendorId);
  return {
    ...p,
    vendor: vp?.businessName ?? 'Unknown Vendor',
    vendorVerified: vp?.verificationStatus === 'FULLY_VERIFIED' || vp?.verificationStatus === 'VERIFIED_VENDOR',
    certifications: p.certifications ? String(p.certifications).split(',').map((c: string) => c.trim()).filter(Boolean) : [],
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q')?.toLowerCase();
  const mine = searchParams.get('mine') === '1';

  const products = await dbClient.product.findMany();
  const vendors = await dbClient.vendorProfile.findMany();

  let list = products
    .filter((p: any) => (category ? p.category === category : true))
    .filter((p: any) => (q ? (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : true));

  if (mine) {
    const user = await resolveUser('VENDOR');
    list = list.filter((p: any) => p.vendorId === user.id);
  }

  return NextResponse.json({ products: list.map((p: any) => withVendor(p, vendors)) });
}

const ProductSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
  category: z.string().min(1).max(60),
  unit: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  certifications: z.string().max(200).optional(),
  imageUrl: z.string().max(300).optional(),
  sku: z.string().max(80).optional(),
  barcode: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  backorderable: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = ProductSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product' }, { status: 400 });

  const product = await dbClient.product.create({
    data: {
      ...parsed.data,
      vendorId: user.id,
      description: parsed.data.description ?? `${parsed.data.name} — professional grade`,
      imageUrl: parsed.data.imageUrl ?? '/images/product-cement.png',
      isActive: 1,
    },
  });
  return NextResponse.json({ success: true, product }, { status: 201 });
}

const UpdateSchema = ProductSchema.partial().extend({ id: z.string() });

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.product.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.vendorId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, ...data } = parsed.data;
  const product = await dbClient.product.update({ where: { id }, data });
  return NextResponse.json({ success: true, product });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing: any = await dbClient.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.vendorId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbClient.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
