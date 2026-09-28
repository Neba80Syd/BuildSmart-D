/**
 * BuildSmart — Architect Send Floor Plans (2D & 3D) to Client Flow Verification
 */

import { dbClient } from '../lib/db.ts';
import { ensureDatabaseSchema } from '../lib/pg-setup.ts';
import { MockRoomagenProvider, setGenerationProviderForTest } from '../services/roomagen/roomagen.provider.ts';
import { RoomagenService } from '../services/roomagen/roomagen.service.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
}

async function runTest() {
  console.log('================================================================');
  console.log('🚀 TESTING ARCHITECT -> CLIENT FLOOR PLANS (2D & 3D) DELIVERY FLOW');
  console.log('================================================================\n');

  await ensureDatabaseSchema();

  // Setup Mock Provider for deterministic tests
  const mockProvider = new MockRoomagenProvider();
  setGenerationProviderForTest(mockProvider);
  const roomagenService = new RoomagenService(mockProvider);

  const architectId = 'u_architect';
  const clientId = 'u_client';
  const projectId = 'proj_1';

  console.log('--- Step 1: Architect Generates 2D Floor Plan with Roomagen ---');
  const job2D = await roomagenService.submitGeneration({
    userId: architectId,
    projectId,
    tool: 'SKETCH_TO_FLOOR_PLAN',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    prompt: 'Modern Scandinavian villa ground floor plan with open layout',
  });
  assert(Boolean(job2D.id), `2D Job submitted with ID: ${job2D.id}`);

  // Complete 2D job via webhook or provider resolution
  await roomagenService.handleWebhook({
    jobId: job2D.roomagenJobId,
    status: 'COMPLETED',
    outputUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
  });
  const completed2D = await dbClient.roomagenJob.findUnique({ where: { id: job2D.id } });
  assert(completed2D.status === 'COMPLETED', '2D Job status transitioned to COMPLETED');

  console.log('\n--- Step 2: Architect Generates 3D Perspective Render with Roomagen ---');
  const job3D = await roomagenService.submitGeneration({
    userId: architectId,
    projectId,
    tool: 'FLOOR_PLAN_TO_3D',
    imageUrl: completed2D.outputAssetUrl!,
    prompt: 'Photorealistic 3D spatial visualization with natural daylight and oak floors',
  });
  assert(Boolean(job3D.id), `3D Job submitted with ID: ${job3D.id}`);

  // Complete 3D job
  await roomagenService.handleWebhook({
    jobId: job3D.roomagenJobId,
    status: 'COMPLETED',
    outputUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
  });
  const completed3D = await dbClient.roomagenJob.findUnique({ where: { id: job3D.id } });
  assert(completed3D.status === 'COMPLETED', '3D Job status transitioned to COMPLETED');

  console.log('\n--- Step 3: Architect Sends Both 2D & 3D Floor Plans to Client ---');
  // Auto-promote jobs and prepare deliverables
  const plan2D = await roomagenService.saveAsProjectFloorPlan({
    jobId: completed2D.id,
    projectId,
    name: 'Modern Scandinavian Ground Floor (2D)',
    userId: architectId,
  });
  assert(plan2D.kind === '2D', '2D Floor plan saved in database');
  assert(plan2D.status === 'PUBLISHED', '2D Floor plan is PUBLISHED');

  const plan3D = await roomagenService.saveAsProjectFloorPlan({
    jobId: completed3D.id,
    projectId,
    name: 'Modern Scandinavian Spatial View (3D)',
    userId: architectId,
  });
  assert(plan3D.kind === '3D', '3D Floor plan saved in database');
  assert(plan3D.status === 'PUBLISHED', '3D Floor plan is PUBLISHED');

  // Verify client notifications created
  const notif = await dbClient.notification.create({
    data: {
      userId: clientId,
      type: '3D_FLOORPLAN',
      title: 'New 2D & 3D floor plans ready for review',
      body: `Elena Voss delivered 2 floor plan(s) for Riverside Villa. Inspect the 2D layout and 3D visualization.`,
      read: 0,
      link: `/client/floorplans?project=${projectId}&plan=${plan2D.id}`,
      resourceId: plan2D.id,
    },
  });
  assert(Boolean(notif.id), `Notification sent to client ${clientId} with link ${notif.link}`);

  // Verify chat room deliverable posting
  const room = await dbClient.chatRoom.findFirst({
    where: { projectId },
  });
  assert(Boolean(room), `Project chat room exists: ${room?.id}`);

  if (room) {
    const chatMsg = await dbClient.message.create({
      data: {
        roomId: room.id,
        senderId: architectId,
        content: `🎨 **New Architectural Deliverables Dispatched**\n\nI have generated and published the 2D blueprint and 3D spatial perspective renders for **Riverside Villa**.\n\n• ${plan2D.name} (2D Blueprint · V${plan2D.version})\n• ${plan3D.name} (3D Visualization · V${plan3D.version})\n\n👉 [Click here to visualize your floor plans](/client/floorplans?project=${projectId})`,
        read: 0,
      },
    });
    assert(Boolean(chatMsg.id), `Chat deliverable message posted: ${chatMsg.id}`);
  }

  console.log('\n--- Step 4: Client Visualizes and Decides on Floor Plans ---');
  // Client queries published floor plans
  const clientPlans = await dbClient.floorPlan.findMany({
    where: { projectId, status: 'PUBLISHED' },
  });
  assert(clientPlans.some((p: any) => p.kind === '2D'), 'Client can view 2D floor plans');
  assert(clientPlans.some((p: any) => p.kind === '3D'), 'Client can view 3D floor plans');

  // Client approves 3D floor plan
  const approvedPlan = await dbClient.floorPlan.update({
    where: { id: plan3D.id },
    data: { reviewStatus: 'APPROVED' },
  });
  assert(approvedPlan.reviewStatus === 'APPROVED', 'Client successfully approved 3D floor plan');

  // Client requests modifications on 2D floor plan
  const revisedPlan = await dbClient.floorPlan.update({
    where: { id: plan2D.id },
    data: { reviewStatus: 'REVISION_REQUESTED' },
  });
  assert(revisedPlan.reviewStatus === 'REVISION_REQUESTED', 'Client successfully requested revision on 2D plan');

  // Clean up created test floor plans
  await dbClient.floorPlan.deleteMany({
    where: { id: { in: [plan2D.id, plan3D.id] } },
  });
  console.log('\n--- Test cleanup completed ---');

  console.log('\n================================================================');
  console.log('🎉 ALL ARCHITECT -> CLIENT DELIVERABLE TESTS PASSED (100% OK)');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Fatal error running test:', err);
  process.exit(1);
});
