import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';
import { respondToDispute } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const prisma = await getPrisma();

  const disputes = await prisma.dispute.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ disputes });
}

const RespondSchema = z.object({
  disputeId: z.string(),
  response: z.string().min(5),
  evidence: z.array(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const parsed = RespondSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  try {
    const updated = await respondToDispute({
      disputeId: parsed.data.disputeId,
      vendorId,
      response: parsed.data.response,
      evidence: parsed.data.evidence,
    });
    return NextResponse.json({ success: true, dispute: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to submit dispute response' }, { status: 400 });
  }
}
