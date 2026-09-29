import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export const APPT_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const appointments = await dbClient.appointment.findMany({ where: { architectId: user.id } });
  const users: any[] = await dbClient.user.findMany();
  const projects: any[] = await dbClient.project.findMany({ where: { architectId: user.id } });
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  const projectFor = (id: string | null) => projects.find((p) => p.id === id);
  return NextResponse.json({
    appointments: appointments.map((a: any) => ({
      ...a,
      clientName: a.clientId ? nameFor(a.clientId) : null,
      projectName: a.projectId ? projectFor(a.projectId)?.name ?? null : null,
    })),
  });
}

const CreateSchema = z.object({
  title: z.string().min(2).max(160),
  type: z.enum(['CONSULTATION', 'PRESENTATION', 'REVIEW', 'SITE', 'MEETING']).default('MEETING'),
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  method: z.enum(['IN_PERSON', 'VIDEO', 'PHONE', 'SITE']).default('VIDEO'),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(APPT_STATUSES).default('PENDING'),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid appointment' }, { status: 400 });

  const appointment = await dbClient.appointment.create({
    data: { ...parsed.data, architectId: user.id, clientId: parsed.data.clientId ?? null, projectId: parsed.data.projectId ?? null },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: appointment.projectId ?? null, type: 'SYSTEM', title: 'Appointment scheduled', body: appointment.title } });
  return NextResponse.json({ success: true, appointment }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(160).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  method: z.enum(['IN_PERSON', 'VIDEO', 'PHONE', 'SITE']).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(APPT_STATUSES).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.appointment.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, ...data } = parsed.data;
  const appointment = await dbClient.appointment.update({ where: { id }, data });
  return NextResponse.json({ success: true, appointment });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const existing: any = await dbClient.appointment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.architectId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbClient.appointment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
