import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export const REQUEST_STATUSES = ['NEW', 'UNDER_REVIEW', 'INFO_REQUIRED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'CANCELLED', 'ARCHIVED'] as const;

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const requests = await dbClient.designRequest.findMany({ where: { architectId: user.id } });
  return NextResponse.json({ requests: requests.map((r: any) => ({ ...r, requirements: safeJson(r.requirements, []) })) });
}

const safeJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const CreateSchema = z.object({
  clientName: z.string().min(2).max(80),
  clientId: z.string().min(1).max(60),
  projectType: z.string().min(1).max(60),
  description: z.string().max(2000).optional(),
  location: z.string().max(160).optional(),
  budget: z.number().nonnegative().optional(),
  style: z.string().max(80).optional(),
  siteArea: z.number().nonnegative().optional(),
  floors: z.number().int().min(1).max(200).optional(),
  rooms: z.number().int().min(1).max(5000).optional(),
  requirements: z.array(z.string().max(300)).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const request = await dbClient.designRequest.create({
    data: { ...parsed.data, architectId: user.id, status: 'NEW', requirements: parsed.data.requirements ?? [] },
  });
  await dbClient.activity.create({ data: { userId: user.id, type: 'CLIENT', title: 'New design request', body: `${parsed.data.clientName} submitted a ${parsed.data.projectType} request.` } });
  return NextResponse.json({ success: true, request }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['ACCEPT', 'REJECT', 'REQUEST_INFO', 'CONVERT', 'START', 'CANCEL', 'ARCHIVE', 'UPDATE']),
  status: z.enum(REQUEST_STATUSES).optional(),
  timeline: z.string().max(80).optional(),
  price: z.number().nonnegative().optional(),
  note: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const existing: any = await dbClient.designRequest.findUnique({ where: { id: d.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Creates (or reuses) the project that backs an accepted request so repeated
  // clicks never duplicate it.
  async function getOrCreateProject() {
    const existingReqs = safeJson(existing.requirements, {});
    const projectName =
      existingReqs?.projectName && typeof existingReqs.projectName === 'string'
        ? existingReqs.projectName
        : `${existing.projectType} — ${existing.clientName}`;
    const candidate = await dbClient.project.findMany({ where: { ownerId: existing.clientId, architectId: user.id } });
    const prior = candidate.find((p: any) => p.name === projectName && !p.archived);
    if (prior) return { project: prior, existingReqs };

    const project = await dbClient.project.create({
      data: {
        name: projectName,
        description: existing.description ?? '',
        status: 'REQUIREMENTS',
        ownerId: existing.clientId,
        architectId: user.id,
        budget: existing.budget ?? 0,
        location: existing.location ?? '',
        progress: 0,
        projectType: existing.projectType,
        siteArea: existing.siteArea ?? null,
        floors: existing.floors ?? null,
        rooms: existing.rooms ?? null,
        style: existing.style ?? null,
        requirements: JSON.stringify(existingReqs),
        archived: false,
      },
    });
    return { project, existingReqs };
  }

  if (d.action === 'START') {
    // Directly start implementation: convert the accepted request into a
    // project and open a new floor-plan draft in the architect's editor.
    if (existing.status !== 'ACCEPTED') {
      return NextResponse.json({ error: 'Only accepted requests can be started' }, { status: 400 });
    }
    const { project } = await getOrCreateProject();
    const plan = await dbClient.floorPlan.create({
      data: {
        projectId: project.id,
        name: 'Project Floorplan',
        data: JSON.stringify({ rooms: [] }),
        svgData: 'project',
        kind: '2D',
        version: 1,
        status: 'DRAFT',
        reviewStatus: 'NOT_STARTED',
      },
    });
    await dbClient.designRequest.update({ where: { id: d.id }, data: { status: 'CONVERTED' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: project.id, type: 'DESIGN', title: 'Project implementation started', body: `Floor plan generated for ${project.name}.` } });
    await dbClient.notification.create({
      data: {
        userId: existing.clientId,
        type: 'PROJECT',
        title: 'Your project has started',
        body: `${user.name} started implementing ${project.name}. A floor plan is being prepared for your review.`,
        read: false,
        link: `/client/floorplans?project=${project.id}&plan=${plan.id}`,
        resourceId: project.id,
      },
    });
    return NextResponse.json({ success: true, project, floorPlan: plan });
  }

  if (d.action === 'CONVERT') {
    // Convert request into a project, transferring relevant information.
    const { project } = await getOrCreateProject();
    await dbClient.designRequest.update({ where: { id: d.id }, data: { status: 'CONVERTED' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: project.id, type: 'PROJECT', title: 'Request converted', body: `${existing.clientName}'s request became project \"${project.name}\"` } });
    return NextResponse.json({ success: true, project });
  }

  const statusMap: Record<string, string> = {
    ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', REQUEST_INFO: 'INFO_REQUIRED', CANCEL: 'CANCELLED', ARCHIVE: 'ARCHIVED',
  };
  const status = d.action === 'UPDATE' ? d.status : statusMap[d.action];

  // Preserve the clarification request so the client can see exactly what the
  // architect needs and respond to it.
  let requirementsData: any = null;
  const requestInfoAction = d.action === 'REQUEST_INFO' && d.note;
  if (requestInfoAction) {
    const parsedReqs = safeJson(existing.requirements, {});
    requirementsData = parsedReqs && typeof parsedReqs === 'object' && !Array.isArray(parsedReqs) ? { ...parsedReqs } : {};
    requirementsData.architectNote = d.note;
    requirementsData.additionalInfo = requirementsData.additionalInfo ?? '';
  }

  const request = await dbClient.designRequest.update({
    where: { id: d.id },
    data: {
      ...(status ? { status } : {}),
      ...(d.timeline !== undefined ? { timeline: d.timeline } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      ...(requestInfoAction ? { requirements: JSON.stringify(requirementsData) } : {}),
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, type: 'CLIENT', title: 'Request updated', body: `${existing.clientName} — ${existing.projectType} → ${status ?? existing.status}` } });

  // Notify the client about the architect's decision / clarification.
  if (status === 'ACCEPTED' || status === 'REJECTED' || status === 'INFO_REQUIRED') {
    const title =
      status === 'ACCEPTED'
        ? 'Your design request was accepted'
        : status === 'REJECTED'
          ? 'Your design request was declined'
          : 'The architect needs more information';
    const body =
      status === 'INFO_REQUIRED' && requirementsData?.architectNote
        ? `${user.name}: ${requirementsData.architectNote}`
        : status === 'ACCEPTED'
          ? `${user.name} accepted your ${existing.projectType} request.`
          : `${user.name} declined your ${existing.projectType} request.`;
    await dbClient.notification.create({
      data: {
        userId: existing.clientId,
        type: status === 'INFO_REQUIRED' ? 'REQUEST' : status === 'ACCEPTED' ? 'PROJECT' : 'REQUEST',
        title,
        body,
        read: false,
        link: `/client/requests?request=${existing.id}`,
        resourceId: existing.id,
      },
    });
  }

  return NextResponse.json({ success: true, request });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing: any = await dbClient.designRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['CANCELLED', 'REJECTED', 'ARCHIVED'].includes(existing.status)) {
    return NextResponse.json({ error: 'Only cancelled, rejected or archived requests can be deleted' }, { status: 400 });
  }
  await dbClient.designRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
