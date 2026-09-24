import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';
import { getWalletSummary } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const wallet = await getWalletSummary(vendorId);

  return NextResponse.json({ wallet });
}
