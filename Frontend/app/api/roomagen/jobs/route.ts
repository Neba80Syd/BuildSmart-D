import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';
import { roomagenLogger } from '@/Backend/services/roomagen/roomagen.logger';

export const dynamic = 'force-dynamic';

const CreateJobSchema = z.object({
  tool: z.enum(['SKETCH_TO_FLOOR_PLAN', 'FLOOR_PLAN_TO_3D', 'FLOOR_PLAN_COLORIZE']),
  imageUrl: z.string().min(1, 'Image URL or asset reference is required'),
  inputAssetId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  options: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const body = await req.json().catch(() => null);

  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid request parameters';
    roomagenLogger.logApiRoute({
      endpoint: '/api/roomagen/jobs',
      method: 'POST',
      userId: user.id,
      bodySummary: { error: 'Validation failed', message: errorMsg },
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMsg,
        },
      },
      { status: 400 }
    );
  }

  roomagenLogger.logApiRoute({
    endpoint: '/api/roomagen/jobs',
    method: 'POST',
    userId: user.id,
    bodySummary: {
      tool: parsed.data.tool,
      projectId: parsed.data.projectId,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
    },
  });

  try {
    const origin = req.nextUrl.origin;
    const webhookUrl = `${origin}/api/webhooks/roomagen`;

    const job = await roomagenService.submitGeneration({
      userId: user.id,
      architectId: user.role === 'ARCHITECT' ? user.id : null,
      projectId: parsed.data.projectId,
      tool: parsed.data.tool,
      imageUrl: parsed.data.imageUrl,
      inputAssetId: parsed.data.inputAssetId,
      prompt: parsed.data.prompt ?? undefined,
      options: parsed.data.options,
      webhookUrl,
    });

    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (err: any) {
    const status = err instanceof RoomagenError ? err.status : 500;
    const code = err instanceof RoomagenError ? err.code : 'ROOMAGEN_GENERATION_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message || 'Unable to generate floor plan';

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || undefined;
  const tool = searchParams.get('tool') || undefined;

  const where: any = { userId: user.id };
  if (projectId) where.projectId = projectId;
  if (tool) where.tool = tool;

  const jobs = await dbClient.roomagenJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: { jobs } });
}
