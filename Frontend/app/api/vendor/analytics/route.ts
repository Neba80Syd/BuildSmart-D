import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext, buildVendorAnalytics, COMMISSION_RATE, CURRENCY } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId, profile } = await getVendorContext(user.id);
  const analytics = await buildVendorAnalytics(vendorId);
  return NextResponse.json({
    vendor: {
      id: vendorId,
      businessName: profile?.businessName ?? 'Store',
      verificationStatus: profile?.verificationStatus ?? 'DRAFT',
      verificationLevel: profile?.verificationLevel ?? 'UNVERIFIED',
    },
    commissionRate: COMMISSION_RATE,
    currency: CURRENCY,
    ...analytics,
  });
}
