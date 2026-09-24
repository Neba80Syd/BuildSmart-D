import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { disputeDesignEscrow } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

const DisputeSchema = z.object({
  reason: z.string().min(3, 'Reason is required'),
  description: z.string().min(10, 'Detailed description is required'),
  evidence: z.any().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser('CLIENT');
    const body = await req.json().catch(() => null);
    const parsed = DisputeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid dispute payload' }, { status: 400 });
    }

    const { reason, description, evidence } = parsed.data;

    let escrow = await dbClient.escrowTransaction.findFirst({
      where: { designId: id, escrowType: 'ARCHITECT' },
    });

    if (!escrow) {
      escrow = await dbClient.escrowTransaction.findUnique({ where: { id } });
    }

    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow transaction not found' }, { status: 404 });
    }

    const dispute = await disputeDesignEscrow({
      escrowId: escrow.id,
      clientId: user.id,
      reason,
      description,
      evidence,
    });

    return NextResponse.json({
      success: true,
      dispute,
      message: 'Dispute submitted. Escrow funds are paused pending administrative review.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to file dispute' }, { status: 400 });
  }
}
