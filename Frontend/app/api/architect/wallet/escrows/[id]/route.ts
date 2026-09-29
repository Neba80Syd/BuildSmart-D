import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser('ARCHITECT');

    const escrow = await dbClient.escrowTransaction.findUnique({ where: { id } });
    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    }

    if (escrow.architectId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized to view this escrow' }, { status: 403 });
    }

    // Fetch related records
    const [clientUser, project, design, revisions, dispute, transactions] = await Promise.all([
      escrow.clientId ? dbClient.user.findUnique({ where: { id: escrow.clientId } }).catch(() => null) : null,
      escrow.projectId ? dbClient.project.findUnique({ where: { id: escrow.projectId } }).catch(() => null) : null,
      escrow.designId ? dbClient.design.findUnique({ where: { id: escrow.designId } }).catch(() => null) : null,
      dbClient.designRevision.findMany({ where: { escrowId: id } }).catch(() => []),
      dbClient.dispute.findFirst({ where: { escrowId: id } }).catch(() => null),
      dbClient.walletTransaction.findMany({ where: { escrowId: id } }).catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      escrow: {
        ...escrow,
        clientName: clientUser?.name || 'Client',
        clientEmail: clientUser?.email || '',
        projectName: project?.name || 'Architectural Design',
        designTitle: design?.title || 'Floor Plan / 3D Model',
        revisions,
        dispute,
        transactions,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch escrow details' }, { status: 500 });
  }
}
