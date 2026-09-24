import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { getSessionUser } from '@/Backend/lib/auth-session';

export const dynamic = 'force-dynamic';

const UNKNOWN_USER = NextResponse.json(
  { authenticated: false, error: 'Authentication required' },
  { status: 401 },
);

async function getCart(userId: string) {
  let cart: any = await dbClient.cart.findUnique({ where: { userId } });
  if (!cart) cart = await dbClient.cart.create({ data: { userId } });
  return cart;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return UNKNOWN_USER;
  if (user.role !== 'ARCHITECT') {
    return NextResponse.json({ error: 'Architect access required' }, { status: 403 });
  }

  const cart = await getCart(user.id);
  const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
  return NextResponse.json({ cart, items });
}

const AddSchema = z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(9999).default(1) });

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return UNKNOWN_USER;
  if (user.role !== 'ARCHITECT') {
    return NextResponse.json({ error: 'Architect access required' }, { status: 403 });
  }

  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const product: any = await dbClient.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const cart = await getCart(user.id);

  const existing = (await dbClient.cartItem.findMany({ where: { cartId: cart.id } })).find((i: any) => i.productId === parsed.data.productId);
  if (existing) {
    await dbClient.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(existing.quantity + parsed.data.quantity, 9999) } });
  } else {
    await dbClient.cartItem.create({ data: { cartId: cart.id, productId: parsed.data.productId, quantity: parsed.data.quantity } });
  }
  const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
  return NextResponse.json({ success: true, items });
}

const PatchSchema = z.object({ id: z.string().min(1), quantity: z.coerce.number().int().min(0).max(9999) });

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return UNKNOWN_USER;
  if (user.role !== 'ARCHITECT') {
    return NextResponse.json({ error: 'Architect access required' }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const cart = await getCart(user.id);
  const item: any = (await dbClient.cartItem.findMany({ where: { cartId: cart.id } })).find((i: any) => i.id === parsed.data.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (parsed.data.quantity === 0) await dbClient.cartItem.delete({ where: { id: item.id } });
  else await dbClient.cartItem.update({ where: { id: item.id }, data: { quantity: parsed.data.quantity } });
  const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
  return NextResponse.json({ success: true, items });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return UNKNOWN_USER;
  if (user.role !== 'ARCHITECT') {
    return NextResponse.json({ error: 'Architect access required' }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id');
  const cart = await getCart(user.id);
  if (id) {
    const item: any = (await dbClient.cartItem.findMany({ where: { cartId: cart.id } })).find((i: any) => i.id === id);
    if (item) await dbClient.cartItem.delete({ where: { id: item.id } });
  } else {
    await dbClient.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  const items = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
  return NextResponse.json({ success: true, items });
}
