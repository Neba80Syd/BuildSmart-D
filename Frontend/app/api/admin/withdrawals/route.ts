import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma, dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';
import { completeWithdrawal, failWithdrawal } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const prisma = await getPrisma();
  const [withdrawals, users, vendorProfiles] = await Promise.all([
    prisma.withdrawal.findMany({ orderBy: { requestedAt: 'desc' } }),
    dbClient.user.findMany(),
    dbClient.vendorProfile.findMany(),
  ]);

  const nameMap = new Map(users.map((u: any) => [u.id, u.name]));
  const businessMap = new Map(vendorProfiles.map((v: any) => [v.id, v.businessName]));

  const enriched = withdrawals.map((w: any) => ({
    ...w,
    vendorName: businessMap.get(w.vendorId) || nameMap.get(w.vendorId) || 'Vendor',
  }));

  return NextResponse.json({ withdrawals: enriched });
}

const ProcessSchema = z.object({
  id: z.string(),
  action: z.enum(['complete', 'fail']),
  providerReference: z.string().optional(),
  reason: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ProcessSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { id, action, providerReference, reason } = parsed.data;

  try {
    let result;
    if (action === 'complete') {
      result = await completeWithdrawal(id, providerReference);
      await audit({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: 'WITHDRAWAL_COMPLETED',
        resource: 'WITHDRAWAL',
        resourceId: id,
        reason: providerReference ? `Provider Ref: ${providerReference}` : null,
      });
    } else {
      result = await failWithdrawal(id, reason ?? 'Rejected by administrator');
      await audit({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: 'WITHDRAWAL_REJECTED',
        resource: 'WITHDRAWAL',
        resourceId: id,
        reason: reason ?? 'Rejected by administrator',
      });
    }

    return NextResponse.json({ success: true, withdrawal: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Action failed' }, { status: 400 });
  }
}
