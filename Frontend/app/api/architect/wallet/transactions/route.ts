import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

    const where: any = { architectId: user.id };
    if (type && type !== 'ALL') {
      where.transactionType = type;
    }

    const transactions = await dbClient.walletTransaction.findMany({
      where,
      take: limit,
    });

    return NextResponse.json({ success: true, transactions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch transactions' }, { status: 500 });
  }
}
