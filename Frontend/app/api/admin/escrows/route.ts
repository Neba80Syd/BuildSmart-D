import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser('ADMIN');
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'VENDOR' | 'ARCHITECT' | 'ALL'
    const status = searchParams.get('status');
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

    const where: any = {};
    if (type && type !== 'ALL') {
      where.escrowType = type;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const escrows = await dbClient.escrowTransaction.findMany({
      where,
      take: limit,
    });

    // Compute overview stats
    const all = await dbClient.escrowTransaction.findMany();
    const totalCount = all.length;
    const activeEscrows = all.filter((e: any) => ['ESCROWED', 'PROCESSING', 'CLIENT_REVIEW', 'CLIENT_CONFIRMATION_PENDING'].includes(e.status));
    const disputedEscrows = all.filter((e: any) => e.status === 'DISPUTED');
    const releasedEscrows = all.filter((e: any) => e.status === 'RELEASED');
    const refundedEscrows = all.filter((e: any) => e.status === 'REFUNDED');

    const totalLockedAmount = activeEscrows.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const totalReleasedAmount = releasedEscrows.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const totalRefundedAmount = refundedEscrows.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    // Enrich escrows with client, vendor, architect names
    const enriched = await Promise.all(
      escrows.map(async (e: any) => {
        let clientName = 'Client';
        let providerName = e.escrowType === 'ARCHITECT' ? 'Architect' : 'Vendor';

        if (e.clientId) {
          const u = await dbClient.user.findUnique({ where: { id: e.clientId } }).catch(() => null);
          if (u?.name) clientName = u.name;
        }

        const providerId = e.architectId || e.vendorId;
        if (providerId) {
          const u = await dbClient.user.findUnique({ where: { id: providerId } }).catch(() => null);
          if (u?.name) providerName = u.name;
        }

        return {
          ...e,
          clientName,
          providerName,
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalCount,
        activeCount: activeEscrows.length,
        disputeCount: disputedEscrows.length,
        releasedCount: releasedEscrows.length,
        refundedCount: refundedEscrows.length,
        totalLockedAmount,
        totalReleasedAmount,
        totalRefundedAmount,
        currency: 'XAF',
      },
      escrows: enriched,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch admin escrows' }, { status: 500 });
  }
}
