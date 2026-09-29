import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { getRoomagenConfig } from '@/Backend/services/roomagen/roomagen.config';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const user = await resolveUser('ADMIN');
  if (user.role !== 'ADMIN' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, { status: 403 });
  }

  const allJobs: any[] = await dbClient.roomagenJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const total = allJobs.length;
  const completed = allJobs.filter((j) => j.status === 'COMPLETED').length;
  const processing = allJobs.filter((j) => j.status === 'PROCESSING').length;
  const failed = allJobs.filter((j) => j.status === 'FAILED').length;
  const pending = allJobs.filter((j) => j.status === 'PENDING').length;

  const toolStats: Record<string, number> = {
    SKETCH_TO_FLOOR_PLAN: allJobs.filter((j) => j.tool === 'SKETCH_TO_FLOOR_PLAN').length,
    FLOOR_PLAN_TO_3D: allJobs.filter((j) => j.tool === 'FLOOR_PLAN_TO_3D').length,
    FLOOR_PLAN_COLORIZE: allJobs.filter((j) => j.tool === 'FLOOR_PLAN_COLORIZE').length,
  };

  const config = getRoomagenConfig();

  // Clean data: never include server-side secrets
  const sanitizedJobs = allJobs.map((j) => ({
    id: j.id,
    roomagenJobId: j.roomagenJobId,
    projectId: j.projectId,
    userId: j.userId,
    tool: j.tool,
    status: j.status,
    version: j.version,
    provider: j.provider,
    inputAssetUrl: j.inputAssetUrl,
    outputAssetUrl: j.outputAssetUrl,
    errorMessage: j.errorMessage,
    completedAt: j.completedAt,
    createdAt: j.createdAt,
  }));

  return NextResponse.json({
    success: true,
    data: {
      metrics: {
        total,
        completed,
        processing,
        failed,
        pending,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 100,
      },
      toolStats,
      provider: config.provider,
      hasKeyConfigured: Boolean(config.apiKey && config.apiKey.length > 5),
      recentJobs: sanitizedJobs,
    },
  });
}
