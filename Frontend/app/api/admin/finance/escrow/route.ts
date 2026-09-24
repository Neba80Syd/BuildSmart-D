import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';
import { processExpiredEscrows, getConfirmationPeriodDays } from '@/Backend/lib/escrow';
import { CURRENCY } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const prisma = await getPrisma();
  const now = new Date();

  const [allEscrows, disputes, wallets, confirmationDays] = await Promise.all([
    prisma.escrowTransaction.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.dispute.findMany(),
    prisma.vendorWallet.findMany(),
    getConfirmationPeriodDays(),
  ]);

  const activeEscrow = allEscrows.filter((e: any) => ['ESCROWED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLIENT_CONFIRMATION_PENDING'].includes(e.status));
  const disputedEscrow = allEscrows.filter((e: any) => e.status === 'DISPUTED');
  const releasedEscrow = allEscrows.filter((e: any) => e.status === 'RELEASED');
  const refundedEscrow = allEscrows.filter((e: any) => e.status === 'REFUNDED');

  const pendingConfirmation = allEscrows.filter((e: any) => e.status === 'CLIENT_CONFIRMATION_PENDING');
  const expiredReadyForRelease = pendingConfirmation.filter((e: any) => e.confirmationDeadline && new Date(e.confirmationDeadline) <= now);

  const metrics = {
    totalEscrowLocked: activeEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalDisputedAmount: disputedEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalReleasedAmount: releasedEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalRefundedAmount: refundedEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    activeCount: activeEscrow.length,
    disputeCount: disputes.filter((d: any) => ['OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'ESCALATED'].includes(d.status)).length,
    pendingConfirmationCount: pendingConfirmation.length,
    expiredReadyCount: expiredReadyForRelease.length,
    totalWallets: wallets.length,
    confirmationDays,
    currency: CURRENCY,
  };

  return NextResponse.json({ metrics, escrows: allEscrows.slice(0, 50) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const result = await processExpiredEscrows();
    await audit({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'ESCROW_AUTO_RELEASE_RUN',
      resource: 'ESCROW',
      resourceId: null,
      reason: `Manual execution of auto-release worker: processed ${result.processed} escrow(s)`,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Auto-release run failed' }, { status: 400 });
  }
}
