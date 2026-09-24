import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { initiateDesignEscrow } from '@/Backend/lib/architect-escrow';
import { getPaymentProvider } from '@/Backend/lib/payment-provider';

export const dynamic = 'force-dynamic';

const FundSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CARD', 'BANK_TRANSFER']).default('MTN_MOMO'),
  clientPhone: z.string().optional(),
  milestoneId: z.string().optional(),
  architectId: z.string().optional(),
  projectId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await resolveUser('CLIENT');
    const body = await req.json().catch(() => null);
    const parsed = FundSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid funding payload' }, { status: 400 });
    }

    const { amount, paymentMethod, clientPhone, milestoneId } = parsed.data;

    // Resolve design / project / architect
    let design: any = await dbClient.design.findUnique({ where: { id } }).catch(() => null);
    let floorPlan: any = null;
    if (!design) {
      floorPlan = await dbClient.floorPlan.findUnique({ where: { id } }).catch(() => null);
    }

    const projectId = parsed.data.projectId || design?.projectId || floorPlan?.projectId;
    const project = projectId ? await dbClient.project.findUnique({ where: { id: projectId } }).catch(() => null) : null;
    const architectId = parsed.data.architectId || design?.architectId || project?.architectId;

    if (!architectId) {
      return NextResponse.json({ success: false, error: 'Cannot fund escrow: architect could not be determined.' }, { status: 400 });
    }

    // Initialize provider transaction
    const provider = getPaymentProvider(paymentMethod);
    const paymentRef = `pay_arch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const providerInit = await provider.initializePayment({
      amount,
      paymentMethod,
      reference: paymentRef,
      description: `Architectural Design Escrow for ${project?.name || design?.title || 'Floor Plan'}`,
      clientPhone,
      clientEmail: user.email,
    });

    // Create escrow hold & unlock final design
    const escrow = await initiateDesignEscrow({
      projectId,
      designId: id,
      milestoneId,
      clientId: user.id,
      architectId,
      amount,
      reference: paymentRef,
      paymentId: providerInit.providerReference,
    });

    return NextResponse.json({
      success: true,
      escrow,
      payment: providerInit,
      message: `Escrow successfully funded! Net ${escrow.amount.toLocaleString()} XAF is secured in review escrow. Full design is unlocked for review.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fund design escrow' }, { status: 400 });
  }
}
