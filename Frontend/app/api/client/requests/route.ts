import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const requests: any[] = await dbClient.designRequest.findMany({ where: { clientId: user.id } });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Architect';
  return NextResponse.json({
    requests: requests.map((r) => ({ ...r, architectName: nameFor(r.architectId), requirements: parseJson(r.requirements, {}) })),
  });
}

const RequestSchema = z.object({
  architectId: z.string().min(1),
  projectName: z.string().max(200).optional(),
  projectType: z.string().min(1).max(60),
  description: z.string().min(1).max(2000),
  location: z.string().max(160).optional(),
  budget: z.number().nonnegative().optional().nullable(),
  style: z.string().max(80).optional(),
  siteArea: z.number().nonnegative().optional().nullable(),
  floors: z.number().int().min(0).optional().nullable(),
  rooms: z.number().int().min(0).optional().nullable(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  parking: z.string().max(200).optional(),
  kitchen: z.string().max(200).optional(),
  specialRequirements: z.string().max(1000).optional(),
  references: z.array(z.string().max(300)).optional(),
  draft: z.boolean().optional(),
});

function requestError(issue: z.ZodIssue) {
  const field = issue.path.join('.') || 'body';
  const messages: Record<string, string> = {
    architectId: 'Please select an architect.',
    projectType: 'Please enter the building type.',
    description: 'Please describe your project.\u2009\u2009(To make your request clearer, try to write at least a short paragraph.)',
    projectName: 'Please enter a project name.',
    budget: 'Budget must be a positive number.',
    siteArea: 'Plot size must be a positive number.',
    floors: 'Number of floors must be a whole number.',
    rooms: 'Number of rooms must be a whole number.',
  };
  const base = messages[field] ?? 'Please check the form and try again.';
  return { field, message: base };
}

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const e = requestError(first);
    return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
  }

  const d = parsed.data;

  // Validate that the selected architect exists and is actually an architect.
  const architect = await dbClient.user.findUnique({ where: { id: d.architectId } });
  const architectProfile = await dbClient.architectProfile.findUnique({ where: { userId: d.architectId } });
  if (!architect || architect.role !== 'ARCHITECT' || !architectProfile) {
    return NextResponse.json({ error: 'Please select a valid architect.', field: 'architectId' }, { status: 400 });
  }

  const requirements = {
    projectName: d.projectName ?? '',
    bedrooms: d.bedrooms ?? 0,
    bathrooms: d.bathrooms ?? 0,
    parking: d.parking ?? '',
    kitchen: d.kitchen ?? '',
    specialRequirements: d.specialRequirements ?? '',
    references: d.references ?? [],
  };

  const request = await dbClient.designRequest.create({
    data: {
      architectId: d.architectId,
      clientId: user.id,
      clientName: user.name,
      projectType: d.projectType,
      description: d.description,
      location: d.location ?? '',
      budget: d.budget ?? null,
      style: d.style ?? '',
      siteArea: d.siteArea ?? null,
      floors: d.floors ?? null,
      rooms: d.rooms ?? null,
      requirements: JSON.stringify(requirements),
      status: d.draft ? 'DRAFT' : 'SUBMITTED',
    },
  });

  await dbClient.activity.create({ data: { userId: user.id, projectId: null, type: 'PROJECT', title: d.draft ? 'Design request draft saved' : 'Design request submitted', body: d.projectName ?? d.projectType } });

  if (!d.draft) {
    // Notify the architect immediately so the request is visible in their
    // Notifications centre and can be opened from there.
    await dbClient.notification.create({
      data: {
        userId: d.architectId,
        type: 'REQUEST',
        title: 'New design request received',
        body: `${user.name} submitted a ${d.projectType} request — ${d.projectName ?? 'Unnamed project'}.`,
        read: false,
        link: `/architect/requests?request=${request.id}`,
        resourceId: request.id,
      },
    });
  }
  return NextResponse.json({ success: true, request }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  action: z.enum(['submit', 'edit', 'provide_info', 'cancel', 'convert']).optional(),
  description: z.string().max(2000).optional(),
  requirements: z.any().optional(),
  additionalInfo: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.designRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.clientId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action } = parsed.data;

  if (action === 'convert') {
    if (existing.status !== 'ACCEPTED') return NextResponse.json({ error: 'Only accepted requests can be converted to a project' }, { status: 400 });
    const reqs = parseJson(existing.requirements, {});
    const projectName =
      reqs?.projectName && typeof reqs.projectName === 'string'
        ? reqs.projectName
        : `${existing.clientName} — ${existing.projectType}`;
    const project = await dbClient.project.create({
      data: {
        name: projectName,
        description: existing.description ?? '',
        ownerId: user.id,
        architectId: existing.architectId,
        status: 'REQUIREMENTS',
        projectType: existing.projectType,
        location: existing.location ?? '',
        budget: existing.budget ?? 0,
        siteArea: existing.siteArea ?? null,
        floors: existing.floors ?? null,
        rooms: existing.rooms ?? null,
        style: existing.style ?? '',
        requirements: JSON.stringify(reqs),
      },
    });
    await dbClient.designRequest.update({ where: { id: existing.id }, data: { status: 'CONVERTED' } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: project.id, type: 'PROJECT', title: 'Request converted to project', body: project.name } });
    return NextResponse.json({ success: true, project, request: { ...existing, status: 'CONVERTED' } });
  }

  if (action === 'cancel') {
    if (['CONVERTED', 'CANCELLED'].includes(existing.status)) return NextResponse.json({ error: 'Request cannot be cancelled' }, { status: 400 });
    const request = await dbClient.designRequest.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ success: true, request });
  }

  if (action === 'submit') {
    const request = await dbClient.designRequest.update({ where: { id: existing.id }, data: { status: 'SUBMITTED' } });
    return NextResponse.json({ success: true, request });
  }

  if (action === 'edit') {
    // Editable only before acceptance.
    if (['ACCEPTED', 'CONVERTED', 'CANCELLED', 'REJECTED'].includes(existing.status)) {
      return NextResponse.json({ error: 'This request can no longer be edited' }, { status: 400 });
    }
    const data: any = {};
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.requirements !== undefined) data.requirements = JSON.stringify(parsed.data.requirements);
    const request = await dbClient.designRequest.update({ where: { id: existing.id }, data });
    return NextResponse.json({ success: true, request });
  }

  if (action === 'provide_info') {
    // Respond to an architect's "Information Required" request.
    const reqs = parseJson(existing.requirements, {});
    reqs.additionalInfo = parsed.data.additionalInfo ?? '';
    const request = await dbClient.designRequest.update({ where: { id: existing.id }, data: { requirements: JSON.stringify(reqs), status: 'SUBMITTED' } });
    return NextResponse.json({ success: true, request });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.designRequest.findUnique({ where: { id } });
  if (!existing || existing.clientId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (existing.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft requests can be deleted' }, { status: 400 });
  await dbClient.designRequest.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
