import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { RoomagenPipelineService } from '@/Backend/services/roomagen/roomagen.pipeline';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';
import { roomagenLogger } from '@/Backend/services/roomagen/roomagen.logger';

export const dynamic = 'force-dynamic';

const PipelineSchema = z.object({
  sketchUrl: z.string().min(1, 'Sketch image URL is required'),
  projectId: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  style: z.string().optional(),
  lighting: z.string().optional(),
  viewMode: z.string().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const body = await req.json().catch(() => null);

  const parsed = PipelineSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid pipeline parameters';
    roomagenLogger.logApiRoute({
      endpoint: '/api/roomagen/pipeline',
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
    endpoint: '/api/roomagen/pipeline',
    method: 'POST',
    userId: user.id,
    bodySummary: {
      projectId: parsed.data.projectId,
      prompt: parsed.data.prompt,
      style: parsed.data.style,
      lighting: parsed.data.lighting,
      viewMode: parsed.data.viewMode,
    },
  });

  try {
    const pipelineService = new RoomagenPipelineService();
    const result = await pipelineService.executeChainedPipeline({
      userId: user.id,
      architectId: user.role === 'ARCHITECT' ? user.id : null,
      projectId: parsed.data.projectId,
      sketchUrl: parsed.data.sketchUrl,
      prompt: parsed.data.prompt ?? undefined,
      style: parsed.data.style,
      lighting: parsed.data.lighting,
      viewMode: parsed.data.viewMode,
      options: parsed.data.options,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    const status = err instanceof RoomagenError ? err.status : 500;
    const code = err instanceof RoomagenError ? err.code : 'PIPELINE_EXECUTION_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message || 'Chained pipeline execution failed';

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
