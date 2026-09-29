import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient, getPrisma } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';
import { resolveDispute } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');

  const prisma = await getPrisma();
  const [disputes, users, escrows, orders] = await Promise.all([
    prisma.dispute.findMany(),
    dbClient.user.findMany(),
    prisma.escrowTransaction.findMany(),
    dbClient.order.findMany(),
  ]);

  const nameFor = (uid: string) => users.find((u: any) => u.id === uid)?.name ?? 'Unknown';
  const escrowByOrder = new Map(escrows.map((e: any) => [e.orderId, e]));
  const orderByOrder = new Map(orders.map((o: any) => [o.id, o]));

  if (id) {
    const d: any = disputes.find((x: any) => x.id === id);
    if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const esc: any = escrowByOrder.get(d.orderId);
    const ord: any = orderByOrder.get(d.orderId);
    return NextResponse.json({
      dispute: {
        ...d,
        parties: parseJson(d.parties, []),
        timeline: parseJson(d.timeline, []),
        assigneeName: d.assignedTo ? nameFor(d.assignedTo) : null,
        clientName: d.clientId ? nameFor(d.clientId) : 'Client',
        vendorName: d.vendorId ? nameFor(d.vendorId) : 'Vendor',
        escrow: esc ?? null,
        order: ord ?? null,
      },
    });
  }

  const list = disputes
    .filter((d: any) => (status ? d.status === status : true))
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((d: any) => {
      const esc: any = escrowByOrder.get(d.orderId);
      return {
        id: d.id,
        orderId: d.orderId,
        title: d.title,
        category: d.category,
        priority: d.priority,
        status: d.status,
        reason: d.reason,
        description: d.description,
        evidence: d.evidence,
        vendorResponse: d.vendorResponse,
        vendorEvidence: d.vendorEvidence,
        amount: d.amount ?? esc?.grossAmount ?? 0,
        parties: parseJson(d.parties, []),
        assigneeName: d.assignedTo ? nameFor(d.assignedTo) : null,
        clientName: d.clientId ? nameFor(d.clientId) : 'Client',
        vendorName: d.vendorId ? nameFor(d.vendorId) : 'Vendor',
        resolutionType: d.resolutionType,
        resolution: d.resolution,
        refundAmount: d.refundAmount,
        releaseAmount: d.releaseAmount,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });

  return NextResponse.json({
    disputes: list,
    statuses: [
      'OPEN',
      'UNDER_REVIEW',
      'AWAITING_RESPONSE',
      'ESCALATED',
      'RESOLVED_FOR_VENDOR',
      'RESOLVED_FOR_CLIENT',
      'PARTIAL_RESOLUTION',
      'CLOSED',
    ],
  });
}

const UpdateSchema = z.object({
  id: z.string(),
  action: z.enum(['assign', 'status', 'note', 'resolve']),
  assigneeId: z.string().optional(),
  status: z
    .enum([
      'OPEN',
      'UNDER_REVIEW',
      'AWAITING_RESPONSE',
      'ESCALATED',
      'RESOLVED_FOR_VENDOR',
      'RESOLVED_FOR_CLIENT',
      'PARTIAL_RESOLUTION',
      'RESOLVED',
      'CLOSED',
    ])
    .optional(),
  note: z.string().max(1000).optional(),
  resolution: z.string().max(1000).optional(),
  resolutionType: z.enum(['RELEASE_VENDOR', 'REFUND_CLIENT', 'PARTIAL']).optional(),
  clientRefundAmount: z.number().nonnegative().optional(),
  vendorReleaseAmount: z.number().nonnegative().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const prisma = await getPrisma();
  const existing: any = await prisma.dispute.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Handle financial resolution if action === 'resolve'
  if (parsed.data.action === 'resolve') {
    const resType = parsed.data.resolutionType ?? 'RELEASE_VENDOR';
    const note = parsed.data.resolution ?? parsed.data.note ?? 'Admin resolved dispute';

    try {
      await resolveDispute({
        disputeId: existing.id,
        adminId: auth.user.id,
        adminName: auth.user.name ?? 'BuildSmart Admin',
        resolutionType: resType,
        resolutionNote: note,
        clientRefundAmount: parsed.data.clientRefundAmount,
        vendorReleaseAmount: parsed.data.vendorReleaseAmount,
      });

      const updated = await prisma.dispute.findUnique({ where: { id: existing.id } });
      return NextResponse.json({ success: true, dispute: updated });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Dispute resolution failed' }, { status: 400 });
    }
  }

  const timeline: any[] = parseJson(existing.timeline, []);
  const data: any = {};
  if (parsed.data.action === 'assign') data.assignedTo = parsed.data.assigneeId ?? null;
  if (parsed.data.action === 'status') data.status = parsed.data.status;
  if (parsed.data.action === 'note' || parsed.data.note) {
    timeline.push({ at: new Date().toISOString(), actor: auth.user.name, text: parsed.data.note ?? 'Note added' });
    data.timeline = timeline;
  }

  const updated = await prisma.dispute.update({ where: { id: existing.id }, data });

  await audit({
    actorId: auth.user.id,
    actorName: auth.user.name,
    action: `DISPUTE_${parsed.data.action.toUpperCase()}`,
    resource: 'DISPUTE',
    resourceId: existing.id,
    reason: parsed.data.note ?? null,
  });

  const partyIds: string[] = parseJson(existing.parties, []).map((p: any) => String(p.id)).filter(Boolean);
  for (const pid of new Set(partyIds)) {
    await notifyUser(pid, 'Dispute updated', `Case ${existing.id} was updated by administration.`);
  }

  return NextResponse.json({ success: true, dispute: { ...updated, timeline: parseJson(updated.timeline, []) } });
}

