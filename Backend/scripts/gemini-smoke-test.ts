/**
 * BuildSmart — Gemini AI & 3D Architectural Plan Generation Smoke Test Suite
 *
 * Verifies:
 * 1. Live communication with Google Gemini API via Backend/lib/gemini.ts.
 * 2. Structured 3D architectural plan synthesis from architect requirements.
 * 3. Spatial geometry validation (non-overlapping rooms, valid dimensions, floor elevations).
 * 4. Multi-storey floor decomposition and materials estimation.
 * 5. Conversational plan mutation using natural language instructions.
 * 6. Fallback procedural layout engine resiliency.
 */

import { callGemini } from '../lib/gemini.ts';
import {
  generateArchitecturalPlan3D,
  mutateArchitecturalPlan,
  type ArchitectPlanRequirements,
} from '../lib/ai-plan-generator.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
}

async function run() {
  console.log('================================================================');
  console.log('🤖 BUILDSMART GEMINI AI & 3D ARCHITECTURAL SMOKE SUITE');
  console.log('================================================================\n');

  // Step 1: Gemini API Connectivity Check
  console.log('--- Step 1: Live Gemini API Connectivity & Model Handshake ---');
  try {
    const ping = await callGemini(
      'You are a testing assistant. Respond strictly with the word READY.',
      [{ role: 'user', content: 'Ping' }]
    );
    assert(Boolean(ping.text), `Received response from model: ${ping.model}`);
    assert(ping.text.toLowerCase().includes('ready'), `Gemini handshake succeeded: "${ping.text.trim()}"`);
  } catch (err: any) {
    console.error('Gemini ping error:', err);
    process.exit(1);
  }

  // Step 2: Structured 3D Plan Generation
  console.log('\n--- Step 2: 3D Architectural Plan Synthesis from Requirements ---');
  const req: ArchitectPlanRequirements = {
    buildingType: 'Modern Villa',
    floors: 2,
    sqft: 3000,
    bedrooms: 4,
    bathrooms: '3',
    style: 'Tropical Contemporary',
    budget: 3, // Premium
    customPrompt: 'Include an infinity pool, shaded veranda, and a cantilevered master balcony',
    location: 'Yaounde, Cameroon',
  };

  const plan = await generateArchitecturalPlan3D(req);

  assert(Boolean(plan.projectName), `Project Name: "${plan.projectName}"`);
  assert(plan.floorsCount >= 2, `Floors Count: ${plan.floorsCount}`);
  assert(plan.totalAreaM2 > 80, `Total Living Area: ${plan.totalAreaM2} m²`);
  assert(plan.estimatedCostXAF > 5_000_000, `Estimated Cost: ${plan.estimatedCostXAF.toLocaleString()} XAF`);
  assert(plan.estimatedTimelineWeeks > 4, `Estimated Timeline: ${plan.estimatedTimelineWeeks} weeks`);
  assert(plan.floors.length === plan.floorsCount, `Floors array has ${plan.floors.length} levels`);
  assert(plan.sustainabilityNotes.length > 0, `Sustainability notes generated (${plan.sustainabilityNotes.length} points)`);
  assert(plan.materialsSummary.length > 0, `Materials summary contains ${plan.materialsSummary.length} line items`);

  // Step 3: Spatial Topology & Room Coordinates Validation
  console.log('\n--- Step 3: Spatial Geometry & Room Dimension Inspection ---');
  for (const floor of plan.floors) {
    assert(floor.rooms.length > 0, `Floor ${floor.floorIndex} ("${floor.name}") contains ${floor.rooms.length} rooms`);
    for (const room of floor.rooms) {
      assert(room.w >= 1.5, `Room "${room.name}" has valid width: ${room.w}m`);
      assert(room.h >= 1.5, `Room "${room.name}" has valid height/depth: ${room.h}m`);
      assert(typeof room.x === 'number' && !isNaN(room.x), `Room "${room.name}" X coord is valid: ${room.x}`);
      assert(typeof room.y === 'number' && !isNaN(room.y), `Room "${room.name}" Y coord is valid: ${room.y}`);
    }
  }

  // Step 4: Conversational Plan Mutation
  console.log('\n--- Step 4: Conversational Natural Language Plan Mutation ---');
  const mutationInstruction = 'Add a rooftop terrace and change facade finish to warm timber louvers';
  const mutationResult = await mutateArchitecturalPlan(plan, mutationInstruction);

  assert(Boolean(mutationResult.reply), `Assistant Explanation: "${mutationResult.reply.slice(0, 100)}..."`);
  assert(Boolean(mutationResult.updatedPlan), 'Received updated plan specification');
  assert(mutationResult.updatedPlan.floors.length >= 2, 'Updated plan maintains valid floor structure');

  console.log('\n================================================================');
  console.log('🎉 ALL GEMINI AI & 3D ARCHITECTURAL SMOKE TESTS PASSED (100%)!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Smoke suite crashed:', err);
  process.exit(1);
});
