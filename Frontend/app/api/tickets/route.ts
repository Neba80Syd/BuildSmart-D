import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const;

const CreateSchema = z.object({
  subject: z.string().min(4).max(160),
  category: z.string().min(1).max(60),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().min(10).max(4000),
});

export async function GET(req: NextRequest) {
  const role = new URL(req.url).searchParams.get('role')?.toUpperCase();
  const user = await resolveUser(role === 'ADMIN' ? 'ADMIN' : 'CLIENT');
  const isAdmin = user.role === 'ADMIN';
  const tickets = await dbClient.supportTicket.findMany({ where: isAdmin ? {} : { userId: user.id } });
  return NextResponse.json({ tickets, isAdmin });
}

export async function POST(req: NextRequest) {
  const user = await resolveUser();
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid ticket' }, { status: 400 });

  const ticket = await dbClient.supportTicket.create({ data: { ...parsed.data, userId: user.id } });
  return NextResponse.json({ success: true, ticket }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  status: z.enum(TICKET_STATUSES).optional(),
  reply: z.string().min(1).max(4000).optional(),
});

export async function PATCH(req: NextRequest) {
  const role = new URL(req.url).searchParams.get('role')?.toUpperCase();
  const user = await resolveUser(role === 'ADMIN' ? 'ADMIN' : 'CLIENT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const ticket = await dbClient.supportTicket.findUnique({ where: { id: parsed.data.id } });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only admins (or the ticket owner, for replying) may modify.
  if (user.role !== 'ADMIN' && ticket.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = Array.isArray(ticket.messages) ? [...ticket.messages] : [];
  if (parsed.data.reply) {
    messages.push({ author: user.role === 'ADMIN' ? 'support' : 'user', body: parsed.data.reply, createdAt: new Date().toISOString() });
  }

  const updated = await dbClient.supportTicket.update({
    where: { id: parsed.data.id },
    data: { ...(parsed.data.status ? { status: parsed.data.status } : {}), messages },
  });
  return NextResponse.json({ success: true, ticket: updated });
}
