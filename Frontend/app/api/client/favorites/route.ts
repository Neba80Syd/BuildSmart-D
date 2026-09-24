import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

const TYPES = ['ARCHITECT', 'DESIGN', 'MATERIAL', 'VENDOR'] as const;

export async function GET() {
  const user = await resolveUser('CLIENT');
  const favorites: any[] = await dbClient.favorite.findMany({ where: { userId: user.id } });

  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';

  const enriched = await Promise.all(
    favorites.map(async (f) => {
      let resource: any = { id: f.resourceId, type: f.resourceType, name: f.resourceId };
      if (f.resourceType === 'ARCHITECT') {
        const p: any = await dbClient.architectProfile.findUnique({ where: { userId: f.resourceId } });
        resource = { id: f.resourceId, type: 'ARCHITECT', name: nameFor(f.resourceId), title: p?.title, verificationStatus: p?.verificationStatus, rating: p?.rating, specializations: parseJson(p?.specializations, []), location: p?.location };
      } else if (f.resourceType === 'DESIGN') {
        const d: any = await dbClient.design.findUnique({ where: { id: f.resourceId } });
        resource = { id: f.resourceId, type: 'DESIGN', name: d?.name ?? f.resourceId, thumbnail: d?.thumbnail, status: d?.status, version: d?.version };
      } else if (f.resourceType === 'MATERIAL') {
        const p: any = await dbClient.product.findUnique({ where: { id: f.resourceId } });
        resource = { id: f.resourceId, type: 'MATERIAL', name: p?.name ?? f.resourceId, price: p?.price, unit: p?.unit, category: p?.category, imageUrl: p?.imageUrl };
      } else if (f.resourceType === 'VENDOR') {
        const v: any = await dbClient.vendorProfile.findUnique({ where: { userId: f.resourceId } });
        resource = { id: f.resourceId, type: 'VENDOR', name: v?.businessName ?? f.resourceId, rating: v?.rating, verificationStatus: v?.verificationStatus, location: v?.location };
      }
      return { ...f, resource };
    })
  );

  return NextResponse.json({ favorites: enriched });
}

const AddSchema = z.object({
  resourceType: z.enum(TYPES),
  resourceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid favorite' }, { status: 400 });

  const existing = await dbClient.favorite.findFirst({ where: { userId: user.id, resourceType: parsed.data.resourceType, resourceId: parsed.data.resourceId } });
  if (existing) return NextResponse.json({ success: true, favorite: existing });

  const favorite = await dbClient.favorite.create({ data: { userId: user.id, resourceType: parsed.data.resourceType, resourceId: parsed.data.resourceId } });
  return NextResponse.json({ success: true, favorite }, { status: 201 });
}

const RemoveSchema = z.object({
  resourceType: z.enum(TYPES),
  resourceId: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const body = RemoveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  await dbClient.favorite.deleteWhere({ where: { userId: user.id, resourceType: body.data.resourceType, resourceId: body.data.resourceId } });
  return NextResponse.json({ success: true });
}
