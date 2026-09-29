import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { floorPlanBoqService } from '@/Backend/services/estimation/floorplan-boq.service';

export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  floorPlanId: z.string().min(1),
  projectId: z.string().optional(),
  architectNotes: z.string().max(1500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const result = await floorPlanBoqService.generateEstimateFromFloorPlan({
      floorPlanId: parsed.data.floorPlanId,
      projectId: parsed.data.projectId,
      architectNotes: parsed.data.architectNotes,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      ...result,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[generate-from-floorplan] Estimation generation failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate preliminary BOQ from floor plan' },
      { status: 500 }
    );
  }
}
