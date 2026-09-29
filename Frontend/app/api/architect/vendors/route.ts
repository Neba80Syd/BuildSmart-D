import { NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET() {
  await resolveUser('ARCHITECT');
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const products: any[] = await dbClient.product.findMany();

  return NextResponse.json({
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.businessName,
      description: v.description,
      location: v.location,
      verificationStatus: v.verificationStatus,
      verificationLevel: v.verificationLevel,
      rating: v.rating,
      reviewCount: v.reviewCount,
      logoUrl: v.logoUrl ?? null,
      bannerUrl: v.bannerUrl ?? null,
      productCount: products.filter((p) => p.vendorId === v.id).length,
      // Do not expose confidential verification documents.
    })),
  });
}
