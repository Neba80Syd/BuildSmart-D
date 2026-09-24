import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const products = await dbClient.product.findMany({ where: { vendorId } });
  const productIds = products.map((p) => p.id);
  const nameByProduct: Record<string, string> = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const all = await dbClient.review.findMany({ where: { status: 'APPROVED' } });
  const relevant = all.filter((r) => r.targetId === vendorId || productIds.includes(r.targetId));

  const enriched = relevant.map((r) => ({
    ...r,
    subjectName: r.targetId === vendorId ? 'Store' : nameByProduct[r.targetId] ?? r.targetId,
  }));

  const avg = enriched.length ? enriched.reduce((s, r) => s + r.rating, 0) / enriched.length : 0;
  return NextResponse.json({
    reviews: enriched,
    summary: { total: enriched.length, average: Math.round(avg * 10) / 10 },
  });
}

const RespondSchema = z.object({
  id: z.string(),
  response: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = RespondSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const all = await dbClient.review.findMany({ where: {} });
  const target = all.find((r) => r.id === parsed.data.id);
  if (!target) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  // Only the reviewed vendor may respond to a review about their store/product.
  const products = await dbClient.product.findMany({ where: { vendorId } });
  const ownsTarget = target.targetId === vendorId || products.some((p) => p.id === target.targetId);
  if (!ownsTarget) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await dbClient.review.update({ where: { id: target.id }, data: { response: parsed.data.response, respondedAt: new Date() } });
  return NextResponse.json({ success: true, review: updated });
}
