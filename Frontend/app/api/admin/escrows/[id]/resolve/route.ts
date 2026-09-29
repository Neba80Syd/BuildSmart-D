import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { resolveArchitectDispute } from '@/Backend/lib/architect-escrow';
import { resolveDispute } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

const ResolveSchema = z.object({
  decision: z.enum(['RELEASE_FUNDS', 'FULL_REFUND', 'PARTIAL_REFUND', 'EXTEND_REVIEW']),
  refundAmount: z.number().optional(),
  releaseAmount: z.number().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser('ADMIN');
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ResolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid resolution payload' }, { status: 400 });
    }

    const { decision, refundAmount, releaseAmount, notes } = parsed.data;

    // Check if id is disputeId or escrowId
    let dispute = await dbClient.dispute.findUnique({ where: { id } });
    let escrow: any = null;

    if (dispute) {
      escrow = await dbClient.escrowTransaction.findUnique({ where: { id: dispute.escrowId } });
    } else {
      escrow = await dbClient.escrowTransaction.findUnique({ where: { id } });
      if (escrow) {
        dispute = await dbClient.dispute.findFirst({ where: { escrowId: escrow.id } });
      }
    }

    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow transaction not found' }, { status: 404 });
    }

    if (escrow.escrowType === 'ARCHITECT') {
      if (!dispute) {
        // Create an ad-hoc dispute record to apply admin resolution cleanly
        dispute = await dbClient.dispute.create({
          data: {
            id: `disp_admin_${Date.now()}`,
            escrowId: escrow.id,
            architectId: escrow.architectId,
            clientId: escrow.clientId,
            title: `Admin Action: ${decision}`,
            status: 'OPEN',
            reason: 'Administrative Escrow Resolution',
            amount: escrow.amount,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      const result = await resolveArchitectDispute({
        disputeId: dispute.id,
        adminId: user.id,
        decision,
        refundAmount,
        releaseAmount,
        notes,
      });

      return NextResponse.json({ success: true, result, message: `Architect escrow successfully resolved with ${decision}.` });
    } else {
      // Vendor escrow resolution
      if (!dispute) {
        return NextResponse.json({ success: false, error: 'Vendor dispute record not found' }, { status: 404 });
      }

      const resolutionType = decision === 'FULL_REFUND' ? 'REFUND_CLIENT' : (decision === 'PARTIAL_REFUND' ? 'PARTIAL' : 'RELEASE_VENDOR');
      const res = await resolveDispute({
        disputeId: dispute.id,
        adminId: user.id,
        adminName: user.name || 'Admin',
        resolutionType,
        resolutionNote: notes || `Admin resolved dispute with ${decision}`,
        vendorReleaseAmount: releaseAmount,
        clientRefundAmount: refundAmount,
      });

      return NextResponse.json({ success: true, result: res, message: `Vendor dispute resolved with ${resolutionType}.` });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Dispute resolution failed' }, { status: 500 });
  }
}
