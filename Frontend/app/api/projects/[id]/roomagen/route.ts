import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';
import { roomagenLogger } from '@/Backend/services/roomagen/roomagen.logger';

export const dynamic = 'force-dynamic';

const ProjectGenerateSchema = z.object({
  tool: z.enum(['SKETCH_TO_FLOOR_PLAN', 'FLOOR_PLAN_TO_3D', 'FLOOR_PLAN_COLORIZE']),
  imageUrl: z.string().min(1, 'Image URL is required'),
  inputAssetId: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  options: z.record(z.string(), z.any()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } }, { status: 404 });
  }

  const generations = await roomagenService.getProjectGenerations(projectId);
  return NextResponse.json({ success: true, data: { generations } });
}

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
  const parsed = ProjectGenerateSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid parameters';
    roomagenLogger.logApiRoute({
      endpoint: `/api/projects/${projectId}/roomagen`,
      method: 'POST',
      userId: user.id,
      bodySummary: { error: 'Validation failed', message: errorMsg },
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errorMsg },
      },
      { status: 400 }
    );
  }

  roomagenLogger.logApiRoute({
    endpoint: `/api/projects/${projectId}/roomagen`,
    method: 'POST',
    userId: user.id,
    bodySummary: {
      projectId,
      tool: parsed.data.tool,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
    },
  });

  try {
    const origin = req.nextUrl.origin;
    const webhookUrl = `${origin}/api/webhooks/roomagen`;

    const job = await roomagenService.submitGeneration({
      userId: user.id,
      architectId: user.role === 'ARCHITECT' ? user.id : project.architectId,
      projectId,
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
    const code = err instanceof RoomagenError ? err.code : 'GENERATION_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message;

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
