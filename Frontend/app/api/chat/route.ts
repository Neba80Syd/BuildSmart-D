import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { publish } from '@/Backend/lib/chat-events';
import { resolveUser } from '@/Backend/lib/preview';

// Resolve the team room for the preview identity's primary project.
async function resolveRoom() {
  const rooms: any[] = await dbClient.chatRoom.findMany({ where: {} });
  const teamRoom = rooms.find((r) => r.id === 'room_team' || r.name?.toLowerCase().includes('team'));
  return teamRoom ?? rooms[0] ?? null;
}

function withAuthor(m: any, users: any[]) {
  const u = users.find((x: any) => x.id === m.senderId);
  return { ...m, senderName: u?.name ?? 'Team Member', mine: false };
}

export async function GET() {
  const user = await resolveUser('CLIENT');
  const room = await resolveRoom();
  if (!room) return NextResponse.json({ room: null, messages: [] });

  const messages: any[] = await dbClient.message.findMany({ where: { roomId: room.id } });
  const users = await dbClient.user.findMany();
  const mapped = messages.map((m: any) => ({ ...withAuthor(m, users), mine: m.senderId === user.id }));
  return NextResponse.json({ room, messages: mapped });
}

const SendSchema = z.object({
  roomId: z.string().optional(),
  content: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = SendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Message too long or empty' }, { status: 400 });

  const targetRoomId = parsed.data.roomId;
  let room = null;
  if (targetRoomId) {
    room = await dbClient.chatRoom.findUnique({ where: { id: targetRoomId } });
  }
  if (!room) {
    room = await resolveRoom();
  }
  if (!room) return NextResponse.json({ error: 'No chat room' }, { status: 404 });

  const msg = await dbClient.message.create({
    data: { senderId: user.id, roomId: room.id, content: parsed.data.content, read: 0 },
  });

  // Fan out to SSE subscribers so other clients update in real time.
  publish(msg);

  return NextResponse.json({ success: true, message: msg }, { status: 201 });
}
