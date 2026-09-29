import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const QuoteSchema = z.object({
  vendorId: z.string().min(1),
  productId: z.string().optional(),
  message: z.string().min(5).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = QuoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const vendor: any = await dbClient.vendorProfile.findUnique({ where: { id: parsed.data.vendorId } });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  const inquiry = await dbClient.inquiry.create({
    data: {
      vendorId: parsed.data.vendorId,
      userId: user.id,
      subject: 'Quotation request from architect',
      productId: parsed.data.productId ?? null,
      orderId: null,
      status: 'OPEN',
      messages: [{ from: 'buyer', at: new Date().toISOString(), text: parsed.data.message }],
    },
  });
  await dbClient.activity.create({ data: { userId: user.id, type: 'ORDER', title: 'Quotation requested', body: `Sent to ${vendor.businessName}.` } });
  return NextResponse.json({ success: true, inquiry }, { status: 201 });
}
