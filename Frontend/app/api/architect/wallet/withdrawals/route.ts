import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await resolveUser('ARCHITECT');
    const withdrawals = await dbClient.withdrawal.findMany({
      where: { architectId: user.id },
    });

    return NextResponse.json({ success: true, withdrawals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch withdrawals' }, { status: 500 });
  }
}
