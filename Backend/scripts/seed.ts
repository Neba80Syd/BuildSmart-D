import bcrypt from 'bcryptjs';
import { dbClient } from '../lib/db';

async function seed() {
  console.log('🌱 Seeding BuildSmart AI (pure in-memory DB)...');

  // Clear (for re-seed during dev)
  // Note: mem maps are internal but we can re-create data

  const passwordHash = await bcrypt.hash('demo1234', 10);

  // === USERS ===
  const client = await dbClient.user.create({
    data: { email: 'client@demo.com', name: 'Jordan Ellis', passwordHash, role: 'CLIENT', emailVerified: true },
  });
  await dbClient.userProfile.create({ data: { userId: client.id, location: 'Strasbourg, FR' } });

  const architect = await dbClient.user.create({
    data: { email: 'architect@demo.com', name: 'Elena Voss', passwordHash, role: 'ARCHITECT', emailVerified: true },
  });
  await dbClient.userProfile.create({ data: { userId: architect.id, location: 'Paris, FR' } });
  await dbClient.architectProfile.create({
    data: {
      userId: architect.id,
      biography: '10 years sustainable architecture. LEED AP.',
      specializations: ['Sustainable', 'Residential'],
      experience: 10,
      licenseNumber: 'ARB-48291',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      rating: 4.8,
      reviewCount: 47,
    },
  });

  const vendorUser = await dbClient.user.create({
    data: { email: 'vendor@demo.com', name: 'Marcus Hale', passwordHash, role: 'VENDOR', emailVerified: true },
  });
  await dbClient.userProfile.create({ data: { userId: vendorUser.id } });
  const vendor = await dbClient.vendorProfile.create({
    data: {
      userId: vendorUser.id,
      businessName: 'Prime Materials EU',
      location: 'Lyon, FR',
      verificationLevel: 'VERIFIED_VENDOR',
      verificationStatus: 'FULLY_VERIFIED',
      verifiedAt: new Date().toISOString(),
      rating: 4.7,
    },
  });

  const admin = await dbClient.user.create({
    data: { email: 'admin@demo.com', name: 'Admin', passwordHash, role: 'ADMIN', emailVerified: true },
  });
  await dbClient.userProfile.create({ data: { userId: admin.id } });

  // === PRODUCTS ===
  const productSeeds = [
    ['Portland Cement 50kg', 'Cement', 12.5, 'bag', 1450],
    ['Structural Rebar #8', 'Steel', 1.85, 'm', 9200],
    ['Concrete Block 8x8x16', 'Concrete', 1.35, 'pc', 28400],
    ['Ceramic Floor Tile 60x60', 'Tiles', 4.75, 'm²', 3800],
    ['Galvanized Roofing Sheet', 'Roofing', 19.5, 'sheet', 720],
    ['PVC Electrical Conduit', 'Electrical', 3.9, 'length', 1240],
  ];

  for (const [name, cat, price, unit, stock] of productSeeds) {
    await dbClient.product.create({
      data: {
        vendorId: vendor.id,
        name,
        category: cat,
        price,
        unit,
        stock,
        description: `${name} - professional grade`,
        imageUrl: `https://picsum.photos/id/${20 + Math.floor(Math.random() * 30)}/300/200`,
      },
    });
  }

  // === PROJECT ===
  const proj = await dbClient.project.create({
    data: {
      name: 'Riverside Villa',
      description: 'Luxury 4-bed sustainable villa',
      status: 'DESIGNING',
      ownerId: client.id,
      architectId: architect.id,
      budget: 485000,
      location: 'Strasbourg, FR',
    },
  });

  await dbClient.floorPlan.create({
    data: {
      projectId: proj.id,
      name: 'Ground Floor',
      data: { rooms: [{ id: 'r1', name: 'Living', w: 6.2, h: 5.4 }, { id: 'r2', name: 'Kitchen', w: 3.8, h: 3.2 }] },
      svgData: '<svg width="420" height="300"><rect x="20" y="20" width="380" height="260" fill="#f8f8f6" stroke="#315C4C"/></svg>',
    },
  });

  // === CHAT ===
  const room = await dbClient.chatRoom.create({
    data: { projectId: proj.id, name: 'Riverside Villa Team' },
  });
  await dbClient.chatParticipant.createMany({
    data: [
      { roomId: room.id, userId: client.id },
      { roomId: room.id, userId: architect.id },
    ],
  });
  await dbClient.message.create({
    data: { senderId: architect.id, roomId: room.id, content: 'Initial AI concept ready for review. Please check the floor plan.' },
  });
  await dbClient.message.create({
    data: { senderId: client.id, roomId: room.id, content: 'Great start! Can we adjust the kitchen size a bit?' },
  });

  console.log('\n✅ Seed complete!');
  console.log('Demo accounts (password: demo1234):');
  console.log('  client@demo.com     (CLIENT)');
  console.log('  architect@demo.com  (ARCHITECT — VERIFIED)');
  console.log('  vendor@demo.com     (VENDOR — VERIFIED)');
  console.log('  admin@demo.com      (ADMIN)');
  console.log('Products, project, floor plan and chat seeded.');
}

seed().catch(console.error);
