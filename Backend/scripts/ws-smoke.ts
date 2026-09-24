// BuildSmart AI — WebSocket & Real-Time Messaging Smoke Test
// Validates end-to-end multi-client WebSocket connection, authentication, room multicast,
// typing indicators, and database persistence.

import path from "node:path";
import dotenv from "dotenv";
import { WebSocket } from "ws";
import { dbClient } from "../lib/db.ts";
import { startWebSocketServer } from "../ws-server.ts";

dotenv.config({ path: path.resolve(process.cwd(), "Frontend/.env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PORT = 3001;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let checksPassed = 0;
let checksFailed = 0;

function check(label: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    checksPassed++;
  } else {
    console.error(`  FAIL: ${label}`, extra !== undefined ? extra : "");
    checksFailed++;
  }
}

async function run() {
  console.log("⚡ Starting WebSocket Smoke Test...");

  // Check if WebSocket server is already running
  let isRunning = false;
  try {
    const res = await fetch(`http://localhost:${PORT}/health`);
    if (res.ok) isRunning = true;
  } catch {}

  if (!isRunning) {
    try {
      startWebSocketServer(PORT);
      await wait(500);
    } catch {}
  } else {
    console.log(`  Attaching to active WebSocket server at http://localhost:${PORT}`);
  }

  const url = `ws://localhost:${PORT}`;

  const client1 = new WebSocket(url);
  const client2 = new WebSocket(url);

  const client1Messages: any[] = [];
  const client2Messages: any[] = [];

  client1.on("message", (data) => {
    client1Messages.push(JSON.parse(data.toString()));
  });

  client2.on("message", (data) => {
    client2Messages.push(JSON.parse(data.toString()));
  });

  await new Promise<void>((resolve, reject) => {
    let opened = 0;
    const checkOpen = () => {
      opened++;
      if (opened === 2) resolve();
    };
    client1.on("open", checkOpen);
    client2.on("open", checkOpen);
    setTimeout(() => reject(new Error("Timeout waiting for WebSocket open")), 5000);
  });

  check("Both WebSocket clients connected successfully", client1.readyState === WebSocket.OPEN && client2.readyState === WebSocket.OPEN);

  // Authenticate both clients
  client1.send(
    JSON.stringify({
      type: "auth",
      userId: "u_client",
      userName: "Jordan Ellis",
      role: "CLIENT",
    })
  );

  client2.send(
    JSON.stringify({
      type: "auth",
      userId: "u_architect",
      userName: "Elena Voss",
      role: "ARCHITECT",
    })
  );

  await wait(800);

  const c1Auth = client1Messages.find((m) => m.type === "authenticated");
  const c2Auth = client2Messages.find((m) => m.type === "authenticated");

  check("Client 1 authenticated as Jordan Ellis (CLIENT)", c1Auth?.userId === "u_client");
  check("Client 2 authenticated as Elena Voss (ARCHITECT)", c2Auth?.userId === "u_architect");

  // Both join 'room_team'
  const TEST_ROOM = "room_team";
  client1.send(JSON.stringify({ type: "join_room", roomId: TEST_ROOM }));
  client2.send(JSON.stringify({ type: "join_room", roomId: TEST_ROOM }));

  await wait(300);

  // Test Typing Indicator: Client 2 sends typing event
  client2.send(JSON.stringify({ type: "typing", roomId: TEST_ROOM, isTyping: true }));
  await wait(300);

  const typingNotice = client1Messages.find((m) => m.type === "user_typing" && m.userId === "u_architect");
  check("Client 1 received typing notification from Elena Voss", typingNotice?.isTyping === true);

  // Test Message Sending & Multicast
  const testContent = `Automated WS verification message at ${Date.now()}`;
  client1.send(
    JSON.stringify({
      type: "send_message",
      roomId: TEST_ROOM,
      content: testContent,
      senderId: "u_client",
      clientTempId: "temp_test_1",
    })
  );

  await wait(600);

  // Check Client 1 received ack
  const ack = client1Messages.find((m) => m.type === "message_ack");
  check("Client 1 received message_ack confirmation", !!ack?.messageId);

  // Check Client 2 received the message over WebSocket
  const receivedMsg = client2Messages.find((m) => m.type === "new_message" && m.message?.content === testContent);
  check("Client 2 received new_message event in real time", receivedMsg?.message?.senderId === "u_client");

  // Verify PostgreSQL Database Persistence
  const dbMsg = await dbClient.message.findFirst({ where: { content: testContent } });
  check("Message successfully persisted to PostgreSQL database", dbMsg !== null && dbMsg.roomId === TEST_ROOM);

  // Mark Read test
  client2.send(JSON.stringify({ type: "mark_read", roomId: TEST_ROOM }));
  await wait(300);

  const readEvent = client1Messages.find((m) => m.type === "messages_read" && m.roomId === TEST_ROOM);
  check("Client 1 received messages_read event from Client 2", readEvent !== null);

  // Clean up
  client1.close();
  client2.close();

  console.log("\n==========================================");
  if (checksFailed === 0) {
    console.log(`✅ ALL ${checksPassed} WEBSOCKET SMOKE CHECKS PASSED`);
    process.exit(0);
  } else {
    console.error(`❌ ${checksFailed} CHECKS FAILED (${checksPassed} passed)`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal smoke test error:", err);
  process.exit(1);
});
