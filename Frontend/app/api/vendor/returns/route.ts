import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED'] as const;

async function enrich(returns: any[]) {
  const users = await dbClient.user.findMany();
  const nameByUser: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name ?? 'Client']));
  return returns.map((r) => ({ ...r, customerName: nameByUser[r.userId] ?? 'Client' }));
}

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const returns = await dbClient.returnRequest.findMany({ where: { vendorId } });
  return NextResponse.json({ returns: await enrich(returns) });
}

const ResolveSchema = z.object({
  id: z.string(),
  decision: z.enum(['APPROVE', 'REJECT', 'REFUND']),
  note: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = ResolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing = await dbClient.returnRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.vendorId !== vendorId) return NextResponse.json({ error: 'Return not found or not yours' }, { status: 404 });

  const status = parsed.data.decision === 'APPROVE' ? 'APPROVED' : parsed.data.decision === 'REFUND' ? 'REFUNDED' : 'REJECTED';
  const updated = await dbClient.returnRequest.update({
    where: { id: existing.id },
    data: { status, resolutionNote: parsed.data.note ?? null, resolvedAt: new Date() },
  });

  // Notify the buyer of the resolution.
  await dbClient.notification.create({
    data: {
      userId: existing.userId,
      type: 'RETURN',
      title: `Return ${status.toLowerCase()}`,
      body: `Your return request on order ${existing.orderId} was ${status.toLowerCase()}.${parsed.data.note ? ` ${parsed.data.note}` : ''}`,
      read: 0,
    },
  });

  return NextResponse.json({ success: true, request: updated });
}
