import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    let targetJobId = body.jobId;
    let providerJobId = body.providerJobId;

    // If no jobId specified, find the most recent active or created job
    if (!targetJobId && !providerJobId) {
      const recentJob = await dbClient.roomagenJob.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (recentJob) {
        targetJobId = recentJob.id;
        providerJobId = recentJob.roomagenJobId || `sim_${recentJob.id}`;
      }
    }

    if (!providerJobId) {
      providerJobId = `sim_job_${Date.now()}`;
    }

    const eventStatus = body.status || 'COMPLETED';
    const outputUrl =
      body.outputUrl ||
      '/images/project-floorplan.png';

    const simulatedPayload = {
      event: eventStatus === 'COMPLETED' ? 'job.completed' : 'job.failed',
      jobId: providerJobId,
      status: eventStatus,
      outputUrl: eventStatus === 'COMPLETED' ? outputUrl : undefined,
      error: eventStatus === 'FAILED' ? body.error || 'Simulated test failure' : undefined,
      timestamp: new Date().toISOString(),
      metadata: { simulated: true, triggeredBy: 'Developer Console' },
    };

    const webhookResult = await roomagenService.handleWebhook(simulatedPayload as any);

    return NextResponse.json({
      success: true,
      data: {
        ...webhookResult,
        simulatedPayload,
        targetJobId,
      },
    });
  } catch (err: any) {
    const status = err instanceof RoomagenError ? err.status : 500;
    const code = err instanceof RoomagenError ? err.code : 'WEBHOOK_SIMULATION_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message;

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
