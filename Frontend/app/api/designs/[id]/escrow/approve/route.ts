import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { approveDesignEscrow } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser('CLIENT');

    // Find escrow by designId or escrow id directly
    let escrow = await dbClient.escrowTransaction.findFirst({
      where: {
        designId: id,
        escrowType: 'ARCHITECT',
      },
    });

    if (!escrow) {
      escrow = await dbClient.escrowTransaction.findUnique({ where: { id } });
    }

    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow transaction not found for this design' }, { status: 404 });
    }

    const result = await approveDesignEscrow({
      escrowId: escrow.id,
      clientId: user.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to approve design escrow' }, { status: 400 });
  }
}
