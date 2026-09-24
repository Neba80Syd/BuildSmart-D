import { NextResponse } from 'next/server';
import { getRoomagenConfig } from '@/Backend/services/roomagen/roomagen.config';
import { getGenerationProvider } from '@/Backend/services/roomagen/roomagen.provider';
import { ROOMAGEN_TOOL_SLUGS } from '@/Backend/services/roomagen/roomagen.types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const config = getRoomagenConfig();
  const provider = getGenerationProvider();

  const latencyMs = Date.now() - startTime;

  return NextResponse.json({
    success: true,
    data: {
      status: 'HEALTHY',
      provider: provider.name,
      configured: config.provider === 'mock' ? true : Boolean(config.apiKey),
      baseUrl: config.baseUrl,
      webhookEndpoint: '/api/webhooks/roomagen',
      webhookSecretConfigured: Boolean(config.webhookSecret),
      tools: Object.values(ROOMAGEN_TOOL_SLUGS),
      capabilities: {
        sketchTo2D: true,
        floorPlanTo3D: true,
        colorization: true,
        chainedPipeline: true,
        pollingFallback: true,
        idempotentWebhooks: true,
      },
      latencyMs,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
}
