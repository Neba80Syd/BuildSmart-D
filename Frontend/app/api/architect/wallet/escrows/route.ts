import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = { architectId: user.id, escrowType: 'ARCHITECT' };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const escrows = await dbClient.escrowTransaction.findMany({
      where,
    });

    // Populate client and project names if available
    const enriched = await Promise.all(
      escrows.map(async (esc: any) => {
        let clientName = 'Client';
        let projectName = 'Architectural Design';

        if (esc.clientId) {
          const clientUser = await dbClient.user.findUnique({ where: { id: esc.clientId } }).catch(() => null);
          if (clientUser?.name) clientName = clientUser.name;
        }

        if (esc.projectId) {
          const project = await dbClient.project.findUnique({ where: { id: esc.projectId } }).catch(() => null);
          if (project?.name) projectName = project.name;
        }

        return {
          ...esc,
          clientName,
          projectName,
        };
      })
    );

    return NextResponse.json({ success: true, escrows: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch escrows' }, { status: 500 });
  }
}
