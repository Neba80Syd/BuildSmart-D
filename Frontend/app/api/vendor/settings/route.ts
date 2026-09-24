import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { profile } = await getVendorContext(user.id);
  return NextResponse.json({ profile });
}

const StorefrontSchema = z.object({
  businessName: z.string().min(2).max(120),
  description: z.string().max(1000),
  location: z.string().max(160),
  bannerUrl: z.string().max(400).optional(),
  logoUrl: z.string().max(400).optional(),
  socialLinks: z.record(z.string(), z.string()).optional(),
});

const ShippingSchema = z.object({
  shippingPolicy: z.any(),
});

const DocSchema = z.object({
  name: z.string().min(1).max(160),
  kind: z.string().min(1).max(40),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { profile } = await getVendorContext(user.id);
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const section = new URL(req.url).searchParams.get('section') ?? 'storefront';

  if (section === 'storefront') {
    const parsed = StorefrontSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
    const updated = await dbClient.vendorProfile.update({ where: { userId: user.id }, data: parsed.data });
    return NextResponse.json({ success: true, profile: updated });
  }

  if (section === 'shipping') {
    const parsed = ShippingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const updated = await dbClient.vendorProfile.update({ where: { userId: user.id }, data: { shippingPolicy: parsed.data.shippingPolicy } });
    return NextResponse.json({ success: true, profile: updated });
  }

  return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
}

/** Upload a business-verification document (name + kind) to the profile. */
export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { profile } = await getVendorContext(user.id);
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

  const parsed = DocSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const docs = Array.isArray(profile.verificationDocs) ? [...profile.verificationDocs] : [];
  docs.push({ name: parsed.data.name, kind: parsed.data.kind, status: 'PENDING', uploadedAt: new Date().toISOString() });

  const updated = await dbClient.vendorProfile.update({ where: { userId: user.id }, data: { verificationDocs: docs } });
  return NextResponse.json({ success: true, verificationDocs: updated?.verificationDocs }, { status: 201 });
}
