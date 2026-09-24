import { NextRequest, NextResponse } from 'next/server';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { getRoomagenConfig } from '@/Backend/services/roomagen/roomagen.config';
import { roomagenLogger } from '@/Backend/services/roomagen/roomagen.logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Parse JSON payload safely
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    roomagenLogger.logApiRoute({
      endpoint: '/api/webhooks/roomagen',
      method: 'POST',
      bodySummary: { error: 'Payload must be valid JSON' },
    });
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_WEBHOOK_PAYLOAD', message: 'Payload must be valid JSON' } },
      { status: 400 }
    );
  }

  roomagenLogger.logApiRoute({
    endpoint: '/api/webhooks/roomagen',
    method: 'POST',
    bodySummary: payload,
  });

  // 2. Validate optional webhook signature/secret if configured
  const config = getRoomagenConfig();
  if (config.webhookSecret) {
    const receivedSecret =
      req.headers.get('x-roomagen-signature') ||
      req.headers.get('x-webhook-secret') ||
      req.nextUrl.searchParams.get('secret');

    if (receivedSecret !== config.webhookSecret) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED_WEBHOOK', message: 'Invalid webhook secret' } },
        { status: 401 }
      );
    }
  }

  try {
    // 3. Process webhook idempotently via Roomagen service
    const result = await roomagenService.handleWebhook(payload);
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'WEBHOOK_PROCESSING_FAILED', message: err.message || 'Webhook failed' } },
      { status: 500 }
    );
  }
}
