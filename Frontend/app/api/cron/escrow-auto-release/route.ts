import { NextRequest, NextResponse } from 'next/server';
import { executeArchitectAutoReleaseWorker } from '@/Backend/lib/architect-escrow';
import { processExpiredEscrows } from '@/Backend/lib/escrow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'buildsmart_cron_secret';

    // Optional secret check if configured
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [architectResult, vendorResult] = await Promise.all([
      executeArchitectAutoReleaseWorker().catch((e: any) => ({ processed: 0, releasedCount: 0, error: e.message, releases: [] })),
      processExpiredEscrows().catch((e: any) => ({ processed: 0, error: e.message, releases: [] })),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      architectEscrows: architectResult,
      vendorEscrows: vendorResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Auto release worker failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
