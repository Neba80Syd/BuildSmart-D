import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const tickets: any[] = await dbClient.supportTicket.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  if (id) {
    const t = tickets.find((x) => x.id === id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ticket: { ...t, userName: nameFor(t.userId), assigneeName: t.assignedTo ? nameFor(t.assignedTo) : null, messages: parseJson(t.messages, []), internalNotes: parseJson(t.internalNotes, []) } });
  }

  const list = tickets
    .filter((t) => (status ? t.status === status : true))
    .filter((t) => (category ? t.category === category : true))
    .filter((t) => (q ? `${t.subject ?? ''} ${t.description ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((t) => ({ id: t.id, subject: t.subject, category: t.category, priority: t.priority, status: t.status, userName: nameFor(t.userId), assigneeName: t.assignedTo ? nameFor(t.assignedTo) : null, createdAt: t.createdAt, updatedAt: t.updatedAt }));

  return NextResponse.json({ tickets: list, statuses: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'], categories: [...new Set(tickets.map((t) => t.category).filter(Boolean))] });
}

const UpdateSchema = z.object({
  id: z.string(),
  action: z.enum(['assign', 'status', 'reply', 'note']),
  assigneeId: z.string().optional(),
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED']).optional(),
  message: z.string().max(2000).optional(),
  note: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const existing: any = await dbClient.supportTicket.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.action === 'assign') data.assignedTo = parsed.data.assigneeId ?? null;
  if (parsed.data.action === 'status') data.status = parsed.data.status;

  if (parsed.data.action === 'reply' && parsed.data.message) {
    const messages: any[] = parseJson(existing.messages, []);
    messages.push({ from: 'support', at: new Date().toISOString(), text: parsed.data.message });
    data.messages = messages;
    if (existing.status === 'OPEN' || existing.status === 'ASSIGNED') data.status = 'WAITING_FOR_USER';
  }
  if (parsed.data.action === 'note' && parsed.data.note) {
    const notes: any[] = parseJson(existing.internalNotes, []);
    notes.push({ at: new Date().toISOString(), author: auth.user.name, text: parsed.data.note });
    data.internalNotes = notes;
  }

  const updated = await dbClient.supportTicket.update({ where: { id: existing.id }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `TICKET_${parsed.data.action.toUpperCase()}`, resource: 'SUPPORT_TICKET', resourceId: existing.id, reason: parsed.data.note ?? null });
  if (parsed.data.action === 'reply') await notifyUser(existing.userId, 'Support replied', `Re: ${existing.subject} — ${parsed.data.message?.slice(0, 120)}`, '/support');

  return NextResponse.json({ success: true, ticket: { ...updated, messages: parseJson(updated.messages, []), internalNotes: parseJson(updated.internalNotes, []) } });
}
