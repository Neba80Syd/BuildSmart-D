import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';
import { RoomagenError } from '@/Backend/services/roomagen/roomagen.errors';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUser();
  const { id } = await params;

  try {
    const job = await roomagenService.getJobStatus(id, user.id);
    return NextResponse.json({ success: true, data: job });
  } catch (err: any) {
    const status = err instanceof RoomagenError ? err.status : 500;
    const code = err instanceof RoomagenError ? err.code : 'JOB_LOOKUP_FAILED';
    const message = err instanceof RoomagenError ? err.getUserMessage() : err.message;

    return NextResponse.json({ success: false, error: { code, message } }, { status });
  }
}
