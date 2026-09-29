import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { publish } from '@/Backend/lib/chat-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');

  const participants: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id } });
  const myRoomIds = new Set(participants.map((p) => p.roomId));
  const rooms: any[] = await dbClient.chatRoom.findMany({ where: {} });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Member';

  const conversations: any[] = [];
  for (const room of rooms) {
    if (!myRoomIds.has(room.id)) continue;
    const msgs: any[] = await dbClient.message.findMany({ where: { roomId: room.id } });
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter((m) => !m.read && m.senderId !== user.id).length;
    conversations.push({
      id: room.id,
      name: room.name ?? 'Conversation',
      projectId: room.projectId,
      lastMessage: last ? { content: last.content, senderName: nameFor(last.senderId), createdAt: last.createdAt } : null,
      unread,
    });
  }
  conversations.sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));

  let messages: any[] = [];
  if (roomId && myRoomIds.has(roomId)) {
    const msgs = await dbClient.message.findMany({ where: { roomId } });
    messages = msgs.map((m: any) => ({ ...m, senderName: nameFor(m.senderId), mine: m.senderId === user.id }));
  }

  return NextResponse.json({ conversations, messages, activeRoomId: roomId });
}

const SendSchema = z.object({
  roomId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Message too long or empty' }, { status: 400 });

  // Authorization: architect must be a participant in the room.
  const participants: any[] = await dbClient.chatParticipant.findMany({ where: { roomId: parsed.data.roomId } });
  if (!participants.some((p) => p.userId === user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const msg = await dbClient.message.create({
    data: { senderId: user.id, roomId: parsed.data.roomId, content: parsed.data.content, read: 0 },
  });
  publish(msg);
  return NextResponse.json({ success: true, message: msg }, { status: 201 });
}

const ReadSchema = z.object({ roomId: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = ReadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const participants: any[] = await dbClient.chatParticipant.findMany({ where: { roomId: parsed.data.roomId } });
  if (!participants.some((p) => p.userId === user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const msgs: any[] = await dbClient.message.findMany({ where: { roomId: parsed.data.roomId } });
  for (const m of msgs) {
    if (!m.read && m.senderId !== user.id) await dbClient.message.update({ where: { id: m.id }, data: { read: true } });
  }
  return NextResponse.json({ success: true });
}
