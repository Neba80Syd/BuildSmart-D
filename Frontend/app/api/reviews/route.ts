import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

const ReviewSchema = z.object({
  targetType: z.enum(['ARCHITECT', 'VENDOR', 'PRODUCT', 'SERVICE']),
  targetId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(2000),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get('targetType') as any;
  const targetId = searchParams.get('targetId') as string | undefined;
  const reviews = await dbClient.review.findMany({
    where: { ...(targetType ? { targetType } : {}), ...(targetId ? { targetId } : {}), status: 'APPROVED' },
  });
  const total = reviews.length;
  const avg = total ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / total : 0;
  return NextResponse.json({ reviews, average: Number(avg.toFixed(1)), count: total });
}

export async function POST(req: NextRequest) {
  const user = await resolveUser();
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid review' }, { status: 400 });
  }

  // Prevent duplicate reviews on the same target by the same author.
  const existing = await dbClient.review.findFirst({
    where: { targetType: parsed.data.targetType, targetId: parsed.data.targetId, authorId: user.id },
  });
  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this target.' }, { status: 409 });
  }

  const review = await dbClient.review.create({
    data: { ...parsed.data, authorId: user.id, authorName: user.name },
  });

  // Update the target's aggregate rating.
  const all = await dbClient.review.findMany({ where: { targetType: parsed.data.targetType, targetId: parsed.data.targetId, status: 'APPROVED' } });
  const count = all.length + 1;
  const avg = (all.reduce((s: number, r: any) => s + r.rating, 0) + parsed.data.rating) / count;
  if (parsed.data.targetType === 'ARCHITECT') {
    const profile = await dbClient.architectProfile.findUnique({ where: { userId: parsed.data.targetId } });
    if (profile) await dbClient.architectProfile.update?.({ where: { userId: parsed.data.targetId }, data: { rating: Number(avg.toFixed(1)), reviewCount: count } });
  }

  return NextResponse.json({ success: true, review }, { status: 201 });
}
