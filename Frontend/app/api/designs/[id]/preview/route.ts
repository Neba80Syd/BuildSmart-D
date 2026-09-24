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
    const user = await resolveUser();

    // Check for design or floorplan
    let design: any = await dbClient.design.findUnique({ where: { id } }).catch(() => null);
    let floorPlan: any = null;

    if (!design) {
      floorPlan = await dbClient.floorPlan.findUnique({ where: { id } }).catch(() => null);
    }

    const projectId = design?.projectId || floorPlan?.projectId;
    const project = projectId ? await dbClient.project.findUnique({ where: { id: projectId } }).catch(() => null) : null;

    // Check if an escrow exists for this design or project
    let escrow = await dbClient.escrowTransaction.findFirst({
      where: {
        designId: id,
        escrowType: 'ARCHITECT',
      },
    }).catch(() => null);

    if (!escrow && projectId) {
      escrow = await dbClient.escrowTransaction.findFirst({
        where: {
          projectId,
          escrowType: 'ARCHITECT',
        },
      }).catch(() => null);
    }

    // Determine access & unlock state:
    // If user is the architect or admin, full access is granted.
    // For clients:
    // If escrow exists and is funded/released -> UNLOCKED (no watermark, exports enabled)
    // If escrow is not funded or doesn't exist -> PROTECTED PREVIEW (dynamic watermark, exports disabled)
    const isArchitect = user.role === 'ARCHITECT' || user.id === design?.architectId || user.id === project?.architectId;
    const isAdmin = user.role === 'ADMIN';
    const isClient = user.role === 'CLIENT';

    const isEscrowFunded = escrow && ['ESCROWED', 'CLIENT_REVIEW', 'REVISION_REQUESTED', 'RELEASED'].includes(escrow.status);
    const isUnlocked = isArchitect || isAdmin || Boolean(isEscrowFunded);

    const watermarkText = `BUILDSMART • PROJECT #${project?.id?.slice(-6)?.toUpperCase() || 'BS-1042'} • CLIENT ${project?.ownerId || 'CLIENT'} • ARCHITECT ${project?.architectId || 'ARCHITECT'} • PREVIEW / UNPAID • NOT FINAL DELIVERABLE`;

    return NextResponse.json({
      success: true,
      designId: id,
      projectId,
      isUnlocked,
      escrowStatus: escrow?.status || 'PAYMENT_REQUIRED',
      escrowAmount: escrow?.amount || 150000,
      currency: escrow?.currency || 'XAF',
      acceptanceDeadline: escrow?.acceptanceDeadline || null,
      watermark: isUnlocked
        ? null
        : {
            required: true,
            text: watermarkText,
            subText: 'Full high-resolution 2D CAD files and dimensioned 3D models unlock upon escrow funding.',
            allowExport: false,
            allowHighRes: false,
          },
      revisionCount: escrow?.revisionCount || 0,
      maxRevisions: escrow?.maxRevisions || 2,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to retrieve preview status' }, { status: 500 });
  }
}
