import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { publish } from '@/Backend/lib/chat-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');

  // Rooms where the client participates.
  const parts: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id } });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'User';

  const conversations: any[] = [];
  let messages: any[] = [];

  for (const p of parts) {
    const room: any = await dbClient.chatRoom.findUnique({ where: { id: p.roomId } });
    if (!room) continue;
    const msgs: any[] = await dbClient.message.findMany({ where: { roomId: room.id } });
    const last = msgs[msgs.length - 1] ?? null;
    const other = await dbClient.chatParticipant.findMany({ where: { roomId: room.id } });
    const otherUser = other.find((o) => o.userId !== user.id);
    conversations.push({
      id: room.id,
      name: room.name ?? (otherUser ? nameFor(otherUser.userId) : 'Chat'),
      projectId: room.projectId,
      lastMessage: last ? { ...last, senderName: nameFor(last.senderId) } : null,
      unread: msgs.filter((m) => m.senderId !== user.id && !m.read).length,
    });

    if (roomId && room.id === roomId) {
      messages = msgs.map((m) => ({ ...m, senderName: nameFor(m.senderId), mine: m.senderId === user.id }));
    }
  }

  return NextResponse.json({ conversations, messages });
}

const SendSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Message too long or empty' }, { status: 400 });

  // Authorize room membership.
  const parts: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id, roomId: parsed.data.roomId } });
  if (parts.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const msg = await dbClient.message.create({ data: { senderId: user.id, roomId: parsed.data.roomId, content: parsed.data.content, read: 0 } });
  publish(msg);
  return NextResponse.json({ success: true, message: msg }, { status: 201 });
}

const ReadSchema = z.object({
  roomId: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ReadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const parts: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id, roomId: parsed.data.roomId } });
  if (parts.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const msgs: any[] = await dbClient.message.findMany({ where: { roomId: parsed.data.roomId } });
  for (const m of msgs) {
    if (m.senderId !== user.id && !m.read) await dbClient.message.update({ where: { id: m.id }, data: { read: true } });
  }
  return NextResponse.json({ success: true });
}
