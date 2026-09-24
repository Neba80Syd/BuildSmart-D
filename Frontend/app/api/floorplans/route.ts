import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') ?? undefined;
  const plans = await dbClient.floorPlan.findMany({ where: projectId ? { projectId } : {} });
  return NextResponse.json({ floorPlans: plans });
}

const FloorPlanSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  data: z.any(), // serialized room layout
  svgData: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = FloorPlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid floor plan' }, { status: 400 });

  const plan = await dbClient.floorPlan.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      data: JSON.stringify(parsed.data.data),
      svgData: parsed.data.svgData,
    },
  });
  return NextResponse.json({ success: true, floorPlan: plan }, { status: 201 });
}
