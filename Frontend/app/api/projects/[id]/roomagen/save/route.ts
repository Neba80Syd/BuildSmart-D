import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';

export const dynamic = 'force-dynamic';

const SavePlanSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  name: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUser('ARCHITECT');
  const { id: projectId } = await params;

  const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SavePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid parameters' },
      },
      { status: 400 }
    );
  }

  try {
    const floorPlan = await roomagenService.saveAsProjectFloorPlan({
      jobId: parsed.data.jobId,
      projectId,
      name: parsed.data.name,
      userId: user.id,
    });

    return NextResponse.json({ success: true, data: { floorPlan } }, { status: 201 });
  } catch (err: any) {
    const status = err instanceof RoomagenError ? err.status : 500;
    const code = err instanceof RoomagenError ? err.code : 'SAVE_FLOORPLAN_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message;

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
