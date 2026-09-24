import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { buildArchitectAnalytics, type AnalyticsRange } from '@/Backend/lib/architect';

export const dynamic = 'force-dynamic';

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d', '180d', '365d'];

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const param = (new URL(req.url).searchParams.get('range') ?? '30d') as AnalyticsRange;
  const range = RANGES.includes(param) ? param : '30d';
  const analytics = await buildArchitectAnalytics(user.id, range);
  return NextResponse.json({ range, ranges: RANGES, ...analytics });
}
