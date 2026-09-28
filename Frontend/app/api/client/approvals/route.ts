import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

// Aggregate every reviewable item awaiting the client's decision.
export async function GET() {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const projectIds = projects.map((p) => p.id);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';

  const designs: any[] = [];
  for (const pid of projectIds) designs.push(...(await dbClient.design.findMany({ where: { projectId: pid } })));
  const reviewableDesigns = designs
    .filter((d) => ['CLIENT_REVIEW', 'REVISION'].includes(d.status))
    .map((d) => ({ kind: 'design', id: d.id, name: d.name, version: d.version, projectId: d.projectId, projectName: projName(d.projectId), status: d.status, thumbnail: d.thumbnail, updatedAt: d.updatedAt }));

  const plans: any[] = [];
  for (const pid of projectIds) plans.push(...(await dbClient.floorPlan.findMany({ where: { projectId: pid } })));
  const reviewablePlans = plans
    .filter((p) => p.status === 'PUBLISHED' && ['READY_FOR_REVIEW', 'UPDATED_READY', 'VIEWED', 'FEEDBACK_SUBMITTED'].includes(p.reviewStatus))
    .map((p) => ({ kind: 'floorplan', id: p.id, name: p.name, planKind: p.kind, version: p.version, projectId: p.projectId, projectName: projName(p.projectId), status: p.reviewStatus, publishedAt: p.publishedAt }));

  // Feedback + architect responses for the client's 3D floorplans.
  const feedback: any[] = [];
  for (const pid of projectIds) feedback.push(...(await dbClient.floorPlanFeedback.findMany({ where: { projectId: pid } })));
  const feedbackByPlan: Record<string, any[]> = {};
  for (const f of feedback) (feedbackByPlan[f.floorPlanId] ??= []).push(f);

  return NextResponse.json({ reviewableDesigns, reviewablePlans, feedbackByPlan, projects });
}

const DecideSchema = z.object({
  kind: z.enum(['design', 'floorplan']),
  id: z.string(),
  action: z.enum(['approve', 'request_changes', 'leave_pending', 'ask_question']),
  comments: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const { kind, id, action, comments } = parsed.data;

  if (kind === 'design') {
    const design: any = await dbClient.design.findUnique({ where: { id } });
    if (!design) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const project: any = design.projectId ? await dbClient.project.findUnique({ where: { id: design.projectId } }) : null;
    if (!(design.clientId === user.id || project?.ownerId === user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'approve') {
      const updated = await dbClient.design.update({ where: { id }, data: { status: 'APPROVED' } });
      // Connect to architectural escrow release if escrow exists
      const escrow = await dbClient.escrowTransaction.findFirst({
        where: { designId: id, escrowType: 'ARCHITECT' },
      }).catch(() => null);
      if (escrow && escrow.status !== 'RELEASED') {
        const { approveDesignEscrow } = await import('@/Backend/lib/architect-escrow');
        await approveDesignEscrow({ escrowId: escrow.id, clientId: user.id }).catch((e) => {
          console.warn('[buildsmart:approvals] Escrow release note:', e.message);
        });
      }
      await dbClient.activity.create({ data: { userId: user.id, projectId: design.projectId, type: 'DESIGN', title: 'Design approved', body: `${design.name} V${design.version}` } });
      await dbClient.notification.create({ data: { userId: design.architectId, type: 'DESIGN', title: 'Design approved', body: `${user.name} approved ${design.name} V${design.version}.`, read: 0 } });
      return NextResponse.json({ success: true, updated });
    }
    if (action === 'request_changes') {
      const updated = await dbClient.design.update({ where: { id }, data: { status: 'REVISION' } });
      // Connect to architectural revision quota tracking
      const escrow = await dbClient.escrowTransaction.findFirst({
        where: { designId: id, escrowType: 'ARCHITECT' },
      }).catch(() => null);
      if (escrow && escrow.status !== 'RELEASED') {
        const { requestDesignRevision } = await import('@/Backend/lib/architect-escrow');
        await requestDesignRevision({
          escrowId: escrow.id,
          clientId: user.id,
          requestNotes: comments || `Changes requested on ${design.name}`,
        }).catch((e) => {
          console.warn('[buildsmart:approvals] Revision quota note:', e.message);
        });
      }
      await dbClient.activity.create({ data: { userId: user.id, projectId: design.projectId, type: 'DESIGN', title: 'Revision requested', body: comments || design.name } });
      await dbClient.notification.create({ data: { userId: design.architectId, type: 'DESIGN', title: 'Revision requested', body: `${user.name} requested changes to ${design.name}.${comments ? ` — ${comments}` : ''}`, read: 0 } });
      return NextResponse.json({ success: true, updated });
    }
    if (action === 'ask_question') {
      await dbClient.notification.create({ data: { userId: design.architectId, type: 'DESIGN', title: 'Design question', body: `${user.name}: ${comments ?? ''}`, read: 0 } });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: true });
  }

  // floorplan approval — tied to the exact published version (this row).
  const plan: any = await dbClient.floorPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 });
  if (plan.status !== 'PUBLISHED') return NextResponse.json({ error: 'This floor plan is not published yet' }, { status: 400 });
  const project: any = await dbClient.project.findUnique({ where: { id: plan.projectId } });
  if (!project || project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (action === 'approve') {
    const updated = await dbClient.floorPlan.update({ where: { id }, data: { reviewStatus: 'APPROVED' } });
    // Check if an architectural escrow is tied to this floorplan or project
    const escrow = await dbClient.escrowTransaction.findFirst({
      where: { projectId: plan.projectId, escrowType: 'ARCHITECT' },
    }).catch(() => null);
    if (escrow && escrow.status !== 'RELEASED') {
      const { approveDesignEscrow } = await import('@/Backend/lib/architect-escrow');
      await approveDesignEscrow({ escrowId: escrow.id, clientId: user.id }).catch((e) => {
        console.warn('[buildsmart:approvals] Floorplan escrow release note:', e.message);
      });
    }
    await dbClient.activity.create({ data: { userId: user.id, projectId: plan.projectId, type: 'DESIGN', title: `${plan.kind} floor plan approved`, body: `${plan.name} (V${plan.version})` } });
    await dbClient.notification.create({ data: { userId: project.architectId, type: 'DESIGN', title: `${plan.kind} floor plan approved`, body: `${user.name} approved ${plan.name} V${plan.version}.`, read: 0 } });
    return NextResponse.json({ success: true, updated });
  }
  if (action === 'request_changes') {
    const updated = await dbClient.floorPlan.update({ where: { id }, data: { reviewStatus: 'REVISION_REQUESTED' } });
    const escrow = await dbClient.escrowTransaction.findFirst({
      where: { projectId: plan.projectId, escrowType: 'ARCHITECT' },
    }).catch(() => null);
    if (escrow && escrow.status !== 'RELEASED') {
      const { requestDesignRevision } = await import('@/Backend/lib/architect-escrow');
      await requestDesignRevision({
        escrowId: escrow.id,
        clientId: user.id,
        requestNotes: comments || `Modifications requested for ${plan.name}`,
      }).catch((e) => {
        console.warn('[buildsmart:approvals] Floorplan revision quota note:', e.message);
      });
    }
    await dbClient.activity.create({ data: { userId: user.id, projectId: plan.projectId, type: 'DESIGN', title: `${plan.kind} revision requested`, body: comments || plan.name } });
    await dbClient.notification.create({ data: { userId: project.architectId, type: 'DESIGN', title: `${plan.kind} revision requested`, body: `${user.name} requested changes to ${plan.name}.${comments ? ` — ${comments}` : ''}`, read: 0 } });
    return NextResponse.json({ success: true, updated });
  }
  if (action === 'ask_question') {
    await dbClient.notification.create({ data: { userId: project.architectId, type: 'DESIGN', title: `${plan.kind} floor plan question`, body: `${user.name}: ${comments ?? ''}`, read: 0 } });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}
