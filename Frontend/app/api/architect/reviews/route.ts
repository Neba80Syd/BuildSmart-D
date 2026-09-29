import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const reviews: any[] = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: user.id, status: 'APPROVED' } });
  const total = reviews.length;
  const avg = total ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / total : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  return NextResponse.json({ reviews, summary: { total, average: Number(avg.toFixed(1)), distribution } });
}

const RespondSchema = z.object({
  id: z.string().min(1),
  response: z.string().min(2).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = RespondSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid response' }, { status: 400 });

  const found: any = (await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: user.id, status: 'APPROVED' } })).find((r: any) => r.id === parsed.data.id);
  if (!found) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  if (found.targetType !== 'ARCHITECT' || found.targetId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const review = await dbClient.review.update({
    where: { id: parsed.data.id },
    data: { response: parsed.data.response, respondedAt: new Date() },
  });
  await dbClient.activity.create({ data: { userId: user.id, type: 'REVIEW', title: 'Review responded', body: `You replied to a ${found.rating}★ review.` } });
  return NextResponse.json({ success: true, review });
}
