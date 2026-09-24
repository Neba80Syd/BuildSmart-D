import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const warehouses = await dbClient.warehouse.findMany({ where: { vendorId } });
  const products = await dbClient.product.findMany({ where: { vendorId } });
  const nameByProduct: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const enriched = [];
  for (const wh of warehouses) {
    const stock = await dbClient.warehouseStock.findMany({ where: { warehouseId: wh.id } });
    enriched.push({
      ...wh,
      stock: stock.map((s) => ({ ...s, productName: nameByProduct[s.productId] ?? s.productId })),
    });
  }

  return NextResponse.json({
    warehouses: enriched,
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock })),
  });
}

const CreateWarehouseSchema = z.object({
  name: z.string().min(2).max(120),
  location: z.string().max(160).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = CreateWarehouseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  if (parsed.data.isDefault) {
    const existing = await dbClient.warehouse.findMany({ where: { vendorId } });
    for (const w of existing) await dbClient.warehouse.update({ where: { id: w.id }, data: { isDefault: false } });
  }

  const warehouse = await dbClient.warehouse.create({ data: { vendorId, ...parsed.data, isDefault: parsed.data.isDefault ?? false } });
  return NextResponse.json({ success: true, warehouse }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(120).optional(),
  location: z.string().max(160).optional(),
  isDefault: z.boolean().optional(),
  stockUpdates: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(0) })).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const warehouses = await dbClient.warehouse.findMany({ where: { vendorId } });
  const warehouse = warehouses.find((w) => w.id === parsed.data.id);
  if (!warehouse) return NextResponse.json({ error: 'Warehouse not found or not yours' }, { status: 404 });

  if (parsed.data.isDefault) {
    for (const w of warehouses) {
      if (w.id !== warehouse.id && w.isDefault) await dbClient.warehouse.update({ where: { id: w.id }, data: { isDefault: false } });
    }
  }

  const { id, stockUpdates, ...fields } = parsed.data;
  if (Object.keys(fields).length) {
    await dbClient.warehouse.update({ where: { id }, data: fields });
  }

  if (stockUpdates) {
    for (const upd of stockUpdates) {
      const existing = await dbClient.warehouseStock.findMany({ where: { warehouseId: id, productId: upd.productId } });
      if (existing[0]) {
        await dbClient.warehouseStock.update({ where: { id: existing[0].id }, data: { quantity: upd.quantity } });
      } else {
        await dbClient.warehouseStock.create({ data: { warehouseId: id, productId: upd.productId, quantity: upd.quantity } });
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const warehouses = await dbClient.warehouse.findMany({ where: { vendorId } });
  const warehouse = warehouses.find((w) => w.id === id);
  if (!warehouse) return NextResponse.json({ error: 'Warehouse not found or not yours' }, { status: 404 });

  await dbClient.warehouseStock.deleteMany({ where: { warehouseId: id } });
  await dbClient.warehouse.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
