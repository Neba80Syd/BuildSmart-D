import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const campaigns = await dbClient.campaign.findMany({ where: { vendorId } });
  return NextResponse.json({ campaigns });
}

const CampaignSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['FLASH_SALE', 'SITE_WIDE']),
  discountType: z.enum(['PERCENT', 'FIXED']).default('PERCENT'),
  discountValue: z.number().nonnegative(),
  startsAt: z.string(),
  endsAt: z.string(),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = CampaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid campaign' }, { status: 400 });

  const campaign = await dbClient.campaign.create({
    data: {
      vendorId,
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    },
  });
  return NextResponse.json({ success: true, campaign }, { status: 201 });
}

const UpdateSchema = z.object({ id: z.string(), active: z.boolean() });

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const campaigns = await dbClient.campaign.findMany({ where: { vendorId } });
  if (!campaigns.find((c) => c.id === parsed.data.id)) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  const campaign = await dbClient.campaign.update({ where: { id: parsed.data.id }, data: { active: parsed.data.active } });
  return NextResponse.json({ success: true, campaign });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const campaigns = await dbClient.campaign.findMany({ where: { vendorId } });
  if (!campaigns.find((c) => c.id === id)) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  await dbClient.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
