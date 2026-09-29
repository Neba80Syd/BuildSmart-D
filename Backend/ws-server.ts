// BuildSmart AI — WebSocket Server
// High-performance real-time messaging, presence detection, and typing indicators
// for multi-stakeholder collaboration across Clients, Architects, Vendors, and Admins.

import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { dbClient } from "./lib/db.ts";
import { publish, subscribe } from "./lib/chat-events.ts";

// Load environment variables
dotenv.config({ quiet: true, path: path.resolve(process.cwd(), "Frontend/.env.local") });
dotenv.config({ quiet: true, path: path.resolve(process.cwd(), ".env") });

export interface ChatSocket extends WebSocket {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  rooms: Set<string>;
  isAlive: boolean;
}

interface ServerState {
  server: http.Server | null;
  wss: WebSocketServer | null;
  port: number;
  usersOnline: Map<string, Set<ChatSocket>>;
  roomSockets: Map<string, Set<ChatSocket>>;
  isListening: boolean;
}

const g = globalThis as unknown as { __buildsmartWsState?: ServerState };

function getState(): ServerState {
  if (!g.__buildsmartWsState) {
    g.__buildsmartWsState = {
      server: null,
      wss: null,
      port: parseInt(process.env.WS_PORT || "3001", 10),
      usersOnline: new Map(),
      roomSockets: new Map(),
      isListening: false,
    };
  }
  return g.__buildsmartWsState;
}

/** Safe JSON send helper */
function sendJson(ws: WebSocket, payload: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error("[buildsmart:ws] Failed to send JSON payload:", err);
    }
  }
}

/** Broadcast to a room */
export function broadcastToRoom(roomId: string, payload: any, excludeWs?: WebSocket) {
  const state = getState();
  const sockets = state.roomSockets.get(roomId);
  if (!sockets || sockets.size === 0) return;

  const data = JSON.stringify(payload);
  for (const client of sockets) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        // Socket error handled by close listener
      }
    }
  }
}

/** Broadcast to a specific user */
export function broadcastToUser(userId: string, payload: any) {
  const state = getState();
  const sockets = state.usersOnline.get(userId);
  if (!sockets || sockets.size === 0) return;

  const data = JSON.stringify(payload);
  for (const client of sockets) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        // Socket error
      }
    }
  }
}

/** Broadcast to all connected clients */
export function broadcastGlobal(payload: any) {
  const state = getState();
  if (!state.wss) return;

  const data = JSON.stringify(payload);
  for (const client of state.wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        // Socket error
      }
    }
  }
}

/** Join a socket to a room */
function joinRoom(socket: ChatSocket, roomId: string) {
  const state = getState();
  socket.rooms.add(roomId);

  if (!state.roomSockets.has(roomId)) {
    state.roomSockets.set(roomId, new Set());
  }
  state.roomSockets.get(roomId)!.add(socket);
}

/** Leave a socket from a room */
function leaveRoom(socket: ChatSocket, roomId: string) {
  const state = getState();
  socket.rooms.delete(roomId);

  const sockets = state.roomSockets.get(roomId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      state.roomSockets.delete(roomId);
    }
  }
}

/** Helper to resolve user details */
async function resolveUserDetails(userId: string) {
  try {
    const user = await dbClient.user.findUnique({ where: { id: userId } });
    if (user) return { name: user.name ?? "Team Member", role: user.role ?? "CLIENT" };
  } catch {
    // Fallback
  }
  return { name: "Team Member", role: "CLIENT" };
}

/** Starts or returns the singleton WebSocket server */
export function startWebSocketServer(portOverride?: number): { wss: WebSocketServer; server: http.Server; port: number } {
  const state = getState();
  const port = portOverride || state.port;

  if (state.wss && state.isListening) {
    return { wss: state.wss, server: state.server!, port: state.port };
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          connections: state.wss?.clients.size ?? 0,
          rooms: state.roomSockets.size,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });
  wss.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[buildsmart:ws] Port ${port} is already bound by another process.`);
    } else {
      console.error("[buildsmart:ws] WebSocketServer error:", err);
    }
  });
  state.server = server;
  state.wss = wss;
  state.port = port;

  // Listen to in-process pub/sub from chat-events.ts (bridge REST -> WebSocket)
  subscribe((event: any) => {
    if (!event) return;
    // If it's a message event
    if (event.roomId) {
      broadcastToRoom(event.roomId, {
        type: "new_message",
        message: event,
      });
      broadcastGlobal({
        type: "conversation_updated",
        roomId: event.roomId,
        lastMessage: event,
      });
    } else if (event.type === "message" && event.message?.roomId) {
      broadcastToRoom(event.message.roomId, {
        type: "new_message",
        message: event.message,
      });
      broadcastGlobal({
        type: "conversation_updated",
        roomId: event.message.roomId,
        lastMessage: event.message,
      });
    }
  });

  wss.on("connection", (ws: WebSocket, req) => {
    const socket = ws as ChatSocket;
    socket.id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    socket.rooms = new Set();
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    // Initial greeting
    sendJson(socket, {
      type: "connected",
      socketId: socket.id,
      timestamp: Date.now(),
      onlineUsers: Array.from(state.usersOnline.keys()),
    });

    socket.on("message", async (data: Buffer | string) => {
      try {
        const text = typeof data === "string" ? data : data.toString("utf8");
        const payload = JSON.parse(text);

        switch (payload.type) {
          // Authentication & identifying session
          case "auth": {
            const { userId, userName, role } = payload;
            if (!userId) break;

            socket.userId = userId;
            const details = await resolveUserDetails(userId);
            socket.userName = userName || details.name;
            socket.userRole = role || details.role;

            if (!state.usersOnline.has(userId)) {
              state.usersOnline.set(userId, new Set());
            }
            state.usersOnline.get(userId)!.add(socket);

            // Automatically join all rooms where this user is a participant
            const parts: any[] = await dbClient.chatParticipant.findMany({ where: { userId } });
            const joinedRooms: string[] = [];
            for (const p of parts) {
              joinRoom(socket, p.roomId);
              joinedRooms.push(p.roomId);
            }

            // Acknowledge auth
            sendJson(socket, {
              type: "authenticated",
              userId: socket.userId,
              userName: socket.userName,
              userRole: socket.userRole,
              joinedRooms,
              onlineUsers: Array.from(state.usersOnline.keys()),
            });

            // Notify participants in their rooms that this user is online
            for (const rId of joinedRooms) {
              broadcastToRoom(
                rId,
                {
                  type: "presence",
                  userId: socket.userId,
                  userName: socket.userName,
                  userRole: socket.userRole,
                  status: "online",
                  roomId: rId,
                },
                socket
              );
            }
            break;
          }

          // Join a specific room
          case "join_room": {
            const { roomId } = payload;
            if (!roomId) break;
            joinRoom(socket, roomId);

            sendJson(socket, {
              type: "room_joined",
              roomId,
            });

            if (socket.userId) {
              broadcastToRoom(
                roomId,
                {
                  type: "presence",
                  userId: socket.userId,
                  userName: socket.userName ?? "Team Member",
                  userRole: socket.userRole ?? "CLIENT",
                  status: "online",
                  roomId,
                },
                socket
              );
            }
            break;
          }

          // Leave a room
          case "leave_room": {
            const { roomId } = payload;
            if (roomId) leaveRoom(socket, roomId);
            break;
          }

          // Real-time Chat message
          case "send_message": {
            const { roomId, content, clientTempId } = payload;
            const trimmed = typeof content === "string" ? content.trim() : "";
            if (!roomId || !trimmed) {
              sendJson(socket, { type: "error", error: "Room ID and content are required." });
              break;
            }

            const senderId = payload.senderId || socket.userId || "u_client";
            const details = await resolveUserDetails(senderId);
            const senderName = socket.userName || details.name;
            const senderRole = socket.userRole || details.role;

            // Ensure sender is added to room sockets
            joinRoom(socket, roomId);

            // Persist message to PostgreSQL
            const savedMessage = await dbClient.message.create({
              data: {
                senderId,
                roomId,
                content: trimmed,
                read: false,
              },
            });

            const enriched = {
              id: savedMessage.id,
              senderId,
              senderName,
              senderRole,
              roomId,
              content: savedMessage.content,
              read: savedMessage.read,
              createdAt: savedMessage.createdAt ? new Date(savedMessage.createdAt).toISOString() : new Date().toISOString(),
            };

            // Multicast to all participants connected to this room
            broadcastToRoom(roomId, {
              type: "new_message",
              message: enriched,
              clientTempId,
            });

            // Inform any clients that may have conversation list open
            broadcastGlobal({
              type: "conversation_updated",
              roomId,
              lastMessage: enriched,
            });

            // In-process bridge to any SSE / local listeners
            publish(enriched);

            // Confirm delivery back to sender
            sendJson(socket, {
              type: "message_ack",
              clientTempId,
              messageId: savedMessage.id,
              createdAt: enriched.createdAt,
            });
            break;
          }

          // Typing indicators
          case "typing": {
            const { roomId, isTyping } = payload;
            if (!roomId || !socket.userId) break;

            broadcastToRoom(
              roomId,
              {
                type: "user_typing",
                roomId,
                userId: socket.userId,
                userName: socket.userName ?? "Team Member",
                isTyping: Boolean(isTyping),
              },
              socket
            );
            break;
          }

          // Mark messages as read
          case "mark_read": {
            const { roomId } = payload;
            if (!roomId || !socket.userId) break;

            try {
              const msgs: any[] = await dbClient.message.findMany({ where: { roomId } });
              for (const m of msgs) {
                if (!m.read && m.senderId !== socket.userId) {
                  await dbClient.message.update({ where: { id: m.id }, data: { read: true } });
                }
              }
              broadcastToRoom(roomId, {
                type: "messages_read",
                roomId,
                userId: socket.userId,
              });
            } catch (err) {
              console.error("[buildsmart:ws] Failed to mark read:", err);
            }
            break;
          }

          // Ping / pong
          case "ping": {
            sendJson(socket, { type: "pong", timestamp: Date.now() });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("[buildsmart:ws] Error processing socket frame:", err);
      }
    });

    socket.on("close", () => {
      // Clean up rooms
      for (const roomId of socket.rooms) {
        leaveRoom(socket, roomId);
      }

      // Clean up user
      if (socket.userId) {
        const userSockets = state.usersOnline.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket);
          if (userSockets.size === 0) {
            state.usersOnline.delete(socket.userId);
            // Broadcast offline presence
            broadcastGlobal({
              type: "presence",
              userId: socket.userId,
              userName: socket.userName,
              status: "offline",
            });
          }
        }
      }
    });

    socket.on("error", (err) => {
      console.error(`[buildsmart:ws] Socket ${socket.id} error:`, err.message);
    });
  });

  // Heartbeat ping/pong every 30s to detect broken connections
  const heartbeat = setInterval(() => {
    if (!state.wss) return;
    for (const ws of state.wss.clients) {
      const socket = ws as ChatSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  state.server.on("close", () => {
    clearInterval(heartbeat);
    state.isListening = false;
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[buildsmart:ws] Port ${port} is already in use. Reusing existing WebSocket server.`);
    } else {
      console.error("[buildsmart:ws] Server error:", err);
    }
  });

  server.listen(port, () => {
    state.isListening = true;
    console.log(`[buildsmart:ws] WebSocket Server listening on port ${port} (ws://localhost:${port})`);
  });

  return { wss, server, port };
}

// Standalone execution: node --experimental-strip-types Backend/ws-server.ts
if (process.argv[1]?.endsWith("ws-server.ts")) {
  console.log("[buildsmart:ws] Launching standalone WebSocket server...");
  startWebSocketServer();
}
