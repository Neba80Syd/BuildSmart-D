import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { getArchitectWalletSummary } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await resolveUser('ARCHITECT');
    const wallet = await getArchitectWalletSummary(user.id);
    return NextResponse.json({ success: true, wallet });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to load architect wallet' }, { status: 500 });
  }
}
