// BuildSmart AI — Stakeholder Chat & Room Seeding
// Idempotently creates default chat rooms connecting Clients, Architects, Vendors, and Admins.

import { dbClient } from "./db.ts";

export async function ensureChatRoomsSeeded() {
  const existingRooms = await dbClient.chatRoom.findMany();
  if (existingRooms.length > 0) {
    console.log(`[buildsmart:chat] Found ${existingRooms.length} existing chat rooms. Skipping seed.`);
    return;
  }

  console.log("[buildsmart:chat] Seeding initial stakeholder chat rooms and messages...");

  const users: any[] = await dbClient.user.findMany();
  const client = users.find((u) => u.role === "CLIENT") ?? { id: "u_client", name: "Jordan Ellis" };
  const architect = users.find((u) => u.role === "ARCHITECT") ?? { id: "u_architect", name: "Elena Voss" };
  const vendor = users.find((u) => u.role === "VENDOR") ?? { id: "u_vendor", name: "Marcus Hale" };
  const admin = users.find((u) => u.role === "ADMIN") ?? { id: "u_admin", name: "BuildSmart Admin" };

  const now = Date.now();
  const minute = 60 * 1000;
  const hour = 60 * minute;

  // 1. Team Collaboration Room (All stakeholders)
  const teamRoom = await dbClient.chatRoom.create({
    data: {
      id: "room_team",
      name: "Riverside Villa — Project Team",
      projectId: "proj_1",
      createdAt: new Date(now - 3 * hour),
    },
  });

  // Add all existing users as participants so anyone logging in has access to the project team room
  for (const u of users) {
    await dbClient.chatParticipant.create({
      data: {
        id: `part_team_${u.id}`,
        roomId: teamRoom.id,
        userId: u.id,
        joinedAt: new Date(now - 3 * hour),
      },
    });
  }

  // Messages in Team Room
  const teamMessages = [
    {
      id: "msg_team_1",
      senderId: architect.id,
      roomId: teamRoom.id,
      content: "Welcome to the Riverside Villa project workspace! I've published the revised Ground Floor Plan (v3) with the double-height living room and shaded veranda.",
      read: true,
      createdAt: new Date(now - 2 * hour - 45 * minute),
    },
    {
      id: "msg_team_2",
      senderId: client.id,
      roomId: teamRoom.id,
      content: "Thanks Elena! The layout looks fantastic. How soon can we confirm the structural concrete mix and rebar schedule?",
      read: true,
      createdAt: new Date(now - 2 * hour - 10 * minute),
    },
    {
      id: "msg_team_3",
      senderId: vendor.id,
      roomId: teamRoom.id,
      content: "Hello team! Marcus here from Prime Materials. We have 500 bags of Portland Cement (Grade 42.5R) and 12mm B500B steel rebar in stock for immediate dispatch.",
      read: true,
      createdAt: new Date(now - 1 * hour - 30 * minute),
    },
    {
      id: "msg_team_4",
      senderId: architect.id,
      roomId: teamRoom.id,
      content: "Excellent Marcus. Please upload the mill test certificate for the 12mm rebar batch so we can sign off with the engineering inspector.",
      read: true,
      createdAt: new Date(now - 45 * minute),
    },
    {
      id: "msg_team_5",
      senderId: admin.id,
      roomId: teamRoom.id,
      content: "BuildSmart Verification: Architect license (ONIGC-2012-0148) and Vendor credentials verified. Secure escrow milestone protection is active.",
      read: true,
      createdAt: new Date(now - 20 * minute),
    },
    {
      id: "msg_team_6",
      senderId: client.id,
      roomId: teamRoom.id,
      content: "Sounds great everyone. Looking forward to our site kickoff review this week!",
      read: false,
      createdAt: new Date(now - 5 * minute),
    },
  ];

  for (const m of teamMessages) {
    await dbClient.message.create({ data: m });
  }

  // 2. Direct 1-on-1 Room: Client <-> Architect
  const clientArchRoom = await dbClient.chatRoom.create({
    data: {
      id: "room_client_architect",
      name: `Consultation: ${client.name} & ${architect.name}`,
      projectId: "proj_1",
      createdAt: new Date(now - 4 * hour),
    },
  });

  await dbClient.chatParticipant.create({
    data: { id: "part_ca_client", roomId: clientArchRoom.id, userId: client.id, joinedAt: new Date(now - 4 * hour) },
  });
  await dbClient.chatParticipant.create({
    data: { id: "part_ca_arch", roomId: clientArchRoom.id, userId: architect.id, joinedAt: new Date(now - 4 * hour) },
  });

  const caMessages = [
    {
      id: "msg_ca_1",
      senderId: client.id,
      roomId: clientArchRoom.id,
      content: "Hi Elena, can we ensure the master bedroom faces the river breezes for passive cooling?",
      read: true,
      createdAt: new Date(now - 3 * hour),
    },
    {
      id: "msg_ca_2",
      senderId: architect.id,
      roomId: clientArchRoom.id,
      content: "Absolutely Jordan. I have angled the upper floor fenestration at 15 degrees north-west to catch the coastal thermal drafts. It will keep mechanical AC usage down by 35%.",
      read: true,
      createdAt: new Date(now - 1 * hour - 15 * minute),
    },
  ];

  for (const m of caMessages) {
    await dbClient.message.create({ data: m });
  }

  // 3. Direct 1-on-1 Room: Client <-> Vendor
  const clientVendorRoom = await dbClient.chatRoom.create({
    data: {
      id: "room_client_vendor",
      name: `Material Supply: ${client.name} & Prime Materials`,
      projectId: "proj_1",
      createdAt: new Date(now - 5 * hour),
    },
  });

  await dbClient.chatParticipant.create({
    data: { id: "part_cv_client", roomId: clientVendorRoom.id, userId: client.id, joinedAt: new Date(now - 5 * hour) },
  });
  await dbClient.chatParticipant.create({
    data: { id: "part_cv_vendor", roomId: clientVendorRoom.id, userId: vendor.id, joinedAt: new Date(now - 5 * hour) },
  });

  const cvMessages = [
    {
      id: "msg_cv_1",
      senderId: client.id,
      roomId: clientVendorRoom.id,
      content: "Hi Marcus, what is the bulk price if we order 1,000 m2 of the Ceramic Floor Tile 60x60?",
      read: true,
      createdAt: new Date(now - 2 * hour),
    },
    {
      id: "msg_cv_2",
      senderId: vendor.id,
      roomId: clientVendorRoom.id,
      content: "Hello Jordan! For 1,000 m2 we can apply an 8% tier discount with free logistics delivery straight to Bonapriso.",
      read: true,
      createdAt: new Date(now - 40 * minute),
    },
  ];

  for (const m of cvMessages) {
    await dbClient.message.create({ data: m });
  }

  // 4. Direct 1-on-1 Room: Architect <-> Vendor
  const archVendorRoom = await dbClient.chatRoom.create({
    data: {
      id: "room_arch_vendor",
      name: `Spec Alignment: ${architect.name} & ${vendor.name}`,
      projectId: "proj_1",
      createdAt: new Date(now - 6 * hour),
    },
  });

  await dbClient.chatParticipant.create({
    data: { id: "part_av_arch", roomId: archVendorRoom.id, userId: architect.id, joinedAt: new Date(now - 6 * hour) },
  });
  await dbClient.chatParticipant.create({
    data: { id: "part_av_vendor", roomId: archVendorRoom.id, userId: vendor.id, joinedAt: new Date(now - 6 * hour) },
  });

  const avMessages = [
    {
      id: "msg_av_1",
      senderId: architect.id,
      roomId: archVendorRoom.id,
      content: "Marcus, is the cement low-heat hydration suitable for large raft foundations in tropical weather?",
      read: true,
      createdAt: new Date(now - 3 * hour - 30 * minute),
    },
    {
      id: "msg_av_2",
      senderId: vendor.id,
      roomId: archVendorRoom.id,
      content: "Yes Elena, it contains fly-ash pozzolanic admixture, preventing thermal micro-cracks during curing.",
      read: true,
      createdAt: new Date(now - 1 * hour),
    },
  ];

  for (const m of avMessages) {
    await dbClient.message.create({ data: m });
  }

  console.log("✅ Initial stakeholder chat rooms and messages seeded successfully.");
}

// Allow direct execution: node --experimental-strip-types Backend/lib/chat-seed.ts
if (process.argv[1]?.endsWith("chat-seed.ts")) {
  ensureChatRoomsSeeded()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Chat seed failed:", err);
      process.exit(1);
    });
}
