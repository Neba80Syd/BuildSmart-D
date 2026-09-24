import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';
import { getWalletTransactions, getWalletSummary } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const type = searchParams.get('type') ?? 'ALL';

  const [summary, { transactions, total }] = await Promise.all([
    getWalletSummary(vendorId),
    getWalletTransactions(vendorId, { limit, offset, type }),
  ]);

  return NextResponse.json({
    summary,
    transactions,
    total,
    limit,
    offset,
  });
}
