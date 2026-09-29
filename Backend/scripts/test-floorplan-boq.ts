import { dbClient } from '../lib/db';
import { floorPlanBoqService } from '../services/estimation/floorplan-boq.service';

async function run() {
  console.log('🧪 [TEST] Starting Floor Plan AI BOQ & Material Estimation Smoke Test...');

  // 1. Resolve test architect, client, and project
  let architect: any = await dbClient.user.findFirst({ where: { role: 'ARCHITECT' } });
  if (!architect) {
    architect = await dbClient.user.create({
      data: {
        email: 'smoke.architect@buildsmart.test',
        password: 'hash',
        name: 'Smoke Test Architect',
        role: 'ARCHITECT',
        verified: 1,
      },
    });
  }

  let client: any = await dbClient.user.findFirst({ where: { role: 'CLIENT' } });
  if (!client) {
    client = await dbClient.user.create({
      data: {
        email: 'smoke.client@buildsmart.test',
        password: 'hash',
        name: 'Smoke Test Client',
        role: 'CLIENT',
        verified: 1,
      },
    });
  }

  let project: any = await dbClient.project.findFirst({
    where: { ownerId: client.id },
  });
  if (!project) {
    project = await dbClient.project.create({
      data: {
        ownerId: client.id,
        name: 'Villa Douala Residence',
        location: 'Douala, Cameroon',
        description: 'Modern 3-Bedroom Contemporary Villa with open living space',
        status: 'DESIGN',
        budget: 65000000,
      },
    });
  }

  // 2. Create a test floor plan with realistic room dimensions
  const sampleRooms = [
    { name: 'Living & Dining Room', w: 7.5, h: 5.5, x: 0, y: 0 },
    { name: 'Master Bedroom with Ensuite', w: 5.0, h: 4.5, x: 7.5, y: 0 },
    { name: 'Bedroom 2', w: 4.0, h: 3.5, x: 0, y: 5.5 },
    { name: 'Bedroom 3', w: 4.0, h: 3.5, x: 4.0, y: 5.5 },
    { name: 'Kitchen & Pantry', w: 4.5, h: 3.5, x: 8.0, y: 4.5 },
    { name: 'Corridor & Circulation', w: 3.5, h: 2.0, x: 4.0, y: 3.5 },
  ];

  const totalArea = sampleRooms.reduce((s, r) => s + r.w * r.h, 0);

  const floorPlan = await dbClient.floorPlan.create({
    data: {
      projectId: project.id,
      name: 'Ground Floor 3-Bedroom Villa Plan',
      kind: '2D',
      version: 1,
      data: JSON.stringify({
        rooms: sampleRooms,
        grossAreaM2: Math.round(totalArea),
        wallThicknessMm: 150,
      }),
    },
  });

  console.log(`✅ [TEST] Created test floor plan "${floorPlan.name}" (ID: ${floorPlan.id}) with ${sampleRooms.length} rooms and ${totalArea.toFixed(1)} m² GFA.`);

  // 3. Test floorPlanBoqService.generateEstimateFromFloorPlan()
  console.log('\n🤖 [TEST] Calling floorPlanBoqService.generateEstimateFromFloorPlan()...');
  const estimateResult = await floorPlanBoqService.generateEstimateFromFloorPlan({
    floorPlanId: floorPlan.id,
    projectId: project.id,
    architectNotes: 'Calibrated for Douala littoral humidity with reinforced footing and 15cm hollow blocks.',
    userId: architect.id,
  });

  if (!estimateResult || !estimateResult.boq) {
    throw new Error('Expected estimateResult.boq to be returned.');
  }

  console.log(`✅ [TEST] Generated BOQ ID: ${estimateResult.boq.id} ("${estimateResult.boq.name}")`);
  console.log(`   - Total Items: ${estimateResult.items.length}`);
  console.log(`   - Total Estimated Cost: ${estimateResult.summary.totalEstimatedCostXaf.toLocaleString()} ${estimateResult.summary.currency}`);
  console.log(`   - Gross Floor Area: ${estimateResult.summary.grossFloorAreaM2} m²`);
  console.log(`   - Estimated Cost/m²: ${estimateResult.summary.costPerM2Xaf?.toLocaleString()} XAF/m²`);
  console.log(`   - Estimated Duration: ${estimateResult.summary.estimatedDurationMonths} months`);
  console.log(`   - Consolidated Bulk Materials: ${estimateResult.materials.length} items`);
  console.log(`   - Engineering Insights: ${estimateResult.engineeringInsights ? 'Available' : 'None'}`);

  // Assertions on generated items
  if (estimateResult.items.length < 5) {
    throw new Error(`Expected at least 5 trade items, got ${estimateResult.items.length}`);
  }
  if (estimateResult.materials.length < 3) {
    throw new Error(`Expected at least 3 bulk materials, got ${estimateResult.materials.length}`);
  }
  if (!estimateResult.summary.totalEstimatedCostXaf || estimateResult.summary.totalEstimatedCostXaf <= 0) {
    throw new Error('Total estimated cost must be positive.');
  }

  // 4. Test floorPlanBoqService.forwardBoqToClient()
  console.log('\n📨 [TEST] Calling floorPlanBoqService.forwardBoqToClient()...');
  const forwardResult = await floorPlanBoqService.forwardBoqToClient({
    boqId: estimateResult.boq.id,
    architectId: architect.id,
    clientId: client.id,
    message: 'Hello! Here is the preliminary Bill of Quantities and Bulk Material Takeoff for the Villa Douala project. Let us know if any adjustments are needed.',
    notifyClient: true,
    postToChat: true,
  });

  if (!forwardResult.success) {
    throw new Error(`Forwarding failed: ${forwardResult.error}`);
  }

  console.log(`✅ [TEST] Forwarded BOQ to client (Status: ${forwardResult.boq?.status}). Notification ID: ${forwardResult.notificationId || 'created'}`);

  // 5. Verify database records
  const updatedBoq: any = await dbClient.boq.findUnique({
    where: { id: estimateResult.boq.id },
  });

  if (updatedBoq.status !== 'SENT') {
    throw new Error(`Expected BOQ status to be SENT, got ${updatedBoq.status}`);
  }

  // Check notification for client
  const clientNotification = await dbClient.notification.findFirst({
    where: {
      userId: client.id,
      resourceId: updatedBoq.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!clientNotification || !clientNotification.link?.startsWith('/client/boq')) {
    throw new Error(`Expected client notification with link /client/boq to exist. Got: ${clientNotification?.link}`);
  }
  console.log(`✅ [TEST] Client notification verified: "${clientNotification.title}" -> ${clientNotification.link}`);

  // Check chat message deliverable card
  const chatMsg = await dbClient.message.findFirst({
    where: {
      senderId: architect.id,
      content: { contains: 'Preliminary BOQ' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (chatMsg) {
    console.log(`✅ [TEST] Team Chat deliverable message verified (ID: ${chatMsg.id})`);
  }

  // Check that client can query their boqs and see it
  const clientBoqs = await dbClient.boq.findMany({
    where: { projectId: project.id },
  });
  const found = clientBoqs.find((b) => b.id === updatedBoq.id);
  if (!found) {
    throw new Error('Client BOQs query should contain the forwarded BOQ.');
  }

  console.log(`\n🎉 [TEST] All smoke tests PASSED successfully!`);
}

run()
  .catch((err) => {
    console.error('❌ [TEST] Error in test:', err);
    process.exit(1);
  })
  .finally(async () => {
    await dbClient.$disconnect?.();
    process.exit(0);
  });
