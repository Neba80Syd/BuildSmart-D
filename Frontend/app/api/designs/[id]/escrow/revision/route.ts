import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { requestDesignRevision, submitDesignRevision } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const revisions = await dbClient.designRevision.findMany({
      where: { designId: id },
    });
    return NextResponse.json({ success: true, revisions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch revisions' }, { status: 500 });
  }
}

const RevisionActionSchema = z.object({
  action: z.enum(['request', 'submit']),
  requestNotes: z.string().optional(),
  revisionId: z.string().optional(),
  responseNotes: z.string().optional(),
  attachments: z.any().optional(),
  newContentHash: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser();
    const body = await req.json().catch(() => null);
    const parsed = RevisionActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid revision payload' }, { status: 400 });
    }

    const { action, requestNotes, revisionId, responseNotes, attachments, newContentHash } = parsed.data;

    // Find escrow
    let escrow = await dbClient.escrowTransaction.findFirst({
      where: { designId: id, escrowType: 'ARCHITECT' },
    });

    if (!escrow) {
      escrow = await dbClient.escrowTransaction.findUnique({ where: { id } });
    }

    if (!escrow) {
      return NextResponse.json({ success: false, error: 'Escrow transaction not found' }, { status: 404 });
    }

    if (action === 'request') {
      if (user.role !== 'CLIENT' && user.id !== escrow.clientId) {
        return NextResponse.json({ success: false, error: 'Only the client can request a revision' }, { status: 403 });
      }

      if (!requestNotes) {
        return NextResponse.json({ success: false, error: 'Revision request notes are required' }, { status: 400 });
      }

      const rev = await requestDesignRevision({
        escrowId: escrow.id,
        clientId: user.id,
        requestNotes,
        attachments,
      });

      return NextResponse.json({
        success: true,
        revision: rev,
        message: `Revision requested successfully (#${rev.revisionNumber} of ${escrow.maxRevisions}).`,
      });
    } else {
      // action === 'submit'
      if (user.role !== 'ARCHITECT' && user.id !== escrow.architectId) {
        return NextResponse.json({ success: false, error: 'Only the architect can submit a revision' }, { status: 403 });
      }

      if (!revisionId) {
        return NextResponse.json({ success: false, error: 'Revision ID is required for submission' }, { status: 400 });
      }

      const rev = await submitDesignRevision({
        revisionId,
        architectId: user.id,
        responseNotes,
        attachments,
        newContentHash,
      });

      return NextResponse.json({
        success: true,
        revision: rev,
        message: 'Revision submitted successfully. 72-hour client review period restarted.',
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Revision action failed' }, { status: 400 });
  }
}
