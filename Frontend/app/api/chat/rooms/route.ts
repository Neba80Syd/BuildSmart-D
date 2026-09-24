import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbClient } from "@/Backend/lib/db";
import { resolveUser } from "@/Backend/lib/preview";
import { publish } from "@/Backend/lib/chat-events";
import { broadcastToRoom } from "@/Backend/ws-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/rooms
 * Fetch all conversations for the current user/stakeholder.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get("role")?.toUpperCase() as any) || "CLIENT";
  const user = await resolveUser(role);

  const parts: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id } });
  const myRoomIds = new Set(parts.map((p) => p.roomId));

  const allRooms: any[] = await dbClient.chatRoom.findMany();
  const allUsers: any[] = await dbClient.user.findMany();
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const conversations: any[] = [];

  for (const room of allRooms) {
    if (!myRoomIds.has(room.id)) continue;

    const roomParts: any[] = await dbClient.chatParticipant.findMany({ where: { roomId: room.id } });
    const otherParts = roomParts.filter((p) => p.userId !== user.id);
    const otherUser = otherParts.length === 1 ? userMap.get(otherParts[0].userId) : null;

    const msgs: any[] = await dbClient.message.findMany({ where: { roomId: room.id } });
    const last = msgs[msgs.length - 1] ?? null;
    const unread = msgs.filter((m) => m.senderId !== user.id && !m.read).length;

    const participantsDetails = roomParts.map((p) => {
      const u = userMap.get(p.userId);
      return {
        userId: p.userId,
        name: u?.name ?? "Team Member",
        role: u?.role ?? "CLIENT",
        isCurrent: p.userId === user.id,
      };
    });

    // Derive display name: explicit room name, or partner name for 1-on-1, or Team
    let displayName = room.name;
    if (!displayName || displayName === "Chat") {
      if (otherUser) {
        displayName = `${otherUser.name} (${otherUser.role})`;
      } else {
        displayName = "Project Team";
      }
    }

    conversations.push({
      id: room.id,
      name: displayName,
      projectId: room.projectId,
      isDirect: otherParts.length === 1,
      directUser: otherUser ? { id: otherUser.id, name: otherUser.name, role: otherUser.role } : null,
      participants: participantsDetails,
      lastMessage: last
        ? {
            id: last.id,
            content: last.content,
            senderId: last.senderId,
            senderName: userMap.get(last.senderId)?.name ?? "Member",
            createdAt: last.createdAt,
          }
        : null,
      unread,
      createdAt: room.createdAt,
    });
  }

  // Sort by most recent activity
  conversations.sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  return NextResponse.json({ user, rooms: conversations });
}

const CreateRoomSchema = z.object({
  name: z.string().optional(),
  participantIds: z.array(z.string()).min(1),
  projectId: z.string().optional(),
  initialMessage: z.string().max(2000).optional(),
});

/**
 * POST /api/chat/rooms
 * Create or get a direct or group conversation with stakeholders.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = (searchParams.get("role")?.toUpperCase() as any) || "CLIENT";
  const currentUser = await resolveUser(role);

  const parsed = CreateRoomSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const { name, participantIds, projectId, initialMessage } = parsed.data;

  // Ensure current user is in the participants set
  const allParticipantIds = Array.from(new Set([currentUser.id, ...participantIds]));

  // If 1-on-1 direct conversation, check if a direct room between these exact 2 users already exists
  if (allParticipantIds.length === 2) {
    const [userA, userB] = allParticipantIds;
    const existingPartsA: any[] = await dbClient.chatParticipant.findMany({ where: { userId: userA } });
    const roomIdsA = new Set(existingPartsA.map((p) => p.roomId));

    for (const rId of roomIdsA) {
      const roomParts: any[] = await dbClient.chatParticipant.findMany({ where: { roomId: rId } });
      if (roomParts.length === 2 && roomParts.some((p) => p.userId === userB)) {
        // Existing 1-on-1 room found! Send initialMessage if provided, then return
        if (initialMessage?.trim()) {
          const msg = await dbClient.message.create({
            data: {
              senderId: currentUser.id,
              roomId: rId,
              content: initialMessage.trim(),
              read: false,
            },
          });
          publish(msg);
          broadcastToRoom(rId, { type: "new_message", message: msg });
        }
        return NextResponse.json({ success: true, roomId: rId, isExisting: true });
      }
    }
  }

  // Create new room
  const targetUser = allParticipantIds.length === 2
    ? (await dbClient.user.findUnique({ where: { id: participantIds[0] } }))
    : null;

  const roomTitle = name || (targetUser ? `${targetUser.name} (${targetUser.role})` : "Project Collaboration");

  const newRoom = await dbClient.chatRoom.create({
    data: {
      name: roomTitle,
      projectId: projectId || "proj_1",
    },
  });

  // Add participants
  for (const pId of allParticipantIds) {
    await dbClient.chatParticipant.create({
      data: {
        roomId: newRoom.id,
        userId: pId,
      },
    });
  }

  // Send initial message if provided
  if (initialMessage?.trim()) {
    const msg = await dbClient.message.create({
      data: {
        senderId: currentUser.id,
        roomId: newRoom.id,
        content: initialMessage.trim(),
        read: false,
      },
    });
    publish(msg);
    broadcastToRoom(newRoom.id, { type: "new_message", message: msg });
  }

  return NextResponse.json({ success: true, roomId: newRoom.id, room: newRoom, isExisting: false }, { status: 201 });
}
