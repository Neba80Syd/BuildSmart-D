import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

const TYPES = ['CONSULTATION', 'PRESENTATION', 'REVIEW', 'SITE', 'MEETING'] as const;
const METHODS = ['IN_PERSON', 'VIDEO', 'PHONE', 'SITE'] as const;

export async function GET() {
  const user = await resolveUser('CLIENT');
  const appointments: any[] = await dbClient.appointment.findMany({ where: { clientId: user.id } });
  const projects = await getClientProjects(user.id);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  return NextResponse.json({
    appointments: appointments.map((a) => ({ ...a, projectName: projName(a.projectId), architectName: nameFor(a.architectId) })),
    projects,
  });
}

const CreateSchema = z.object({
  architectId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  title: z.string().min(2).max(120),
  type: z.enum(TYPES).default('MEETING'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  method: z.enum(METHODS).default('VIDEO'),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid appointment' }, { status: 400 });

  const appointment = await dbClient.appointment.create({
    data: {
      architectId: parsed.data.architectId,
      clientId: user.id,
      projectId: parsed.data.projectId ?? null,
      title: parsed.data.title,
      type: parsed.data.type,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime ?? null,
      method: parsed.data.method,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
      status: 'PENDING',
    },
  });
  await dbClient.notification.create({
    data: { userId: parsed.data.architectId, type: 'APPOINTMENT', title: 'Appointment requested', body: `${user.name} requested "${parsed.data.title}".`, read: 0, link: '/architect/appointments', resourceId: appointment.id },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId: parsed.data.projectId ?? null, type: 'APPOINTMENT', title: 'Appointment requested', body: parsed.data.title } });
  return NextResponse.json({ success: true, appointment }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  action: z.enum(['confirm', 'reschedule', 'cancel']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.appointment.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.clientId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action } = parsed.data;
  let data: any = {};
  if (action === 'confirm') data = { status: 'CONFIRMED' };
  else if (action === 'reschedule') data = { status: 'RESCHEDULED', date: parsed.data.date, startTime: parsed.data.startTime, endTime: parsed.data.endTime ?? null };
  else if (action === 'cancel') {
    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) return NextResponse.json({ error: 'Cannot cancel this appointment' }, { status: 400 });
    data = { status: 'CANCELLED' };
  }

  const appointment = await dbClient.appointment.update({ where: { id: existing.id }, data });
  await dbClient.notification.create({ data: { userId: existing.architectId, type: 'APPOINTMENT', title: `Appointment ${action}ed`, body: `"${existing.title}" was ${action}ed by ${user.name}.`, read: 0 } });
  return NextResponse.json({ success: true, appointment });
}
