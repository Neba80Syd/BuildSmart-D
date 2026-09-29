import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

// Client → vendor quotation / contact request (stored as a vendor inquiry).
const QuoteSchema = z.object({
  vendorId: z.string().min(1),
  productId: z.string().optional().nullable(),
  subject: z.string().min(2).max(160),
  message: z.string().min(2).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = QuoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid quote request' }, { status: 400 });

  const inquiry = await dbClient.inquiry.create({
    data: {
      vendorId: parsed.data.vendorId,
      userId: user.id,
      subject: parsed.data.subject,
      productId: parsed.data.productId ?? null,
      status: 'OPEN',
      messages: [{ from: 'buyer', at: new Date(), text: parsed.data.message }],
    },
  });

  await dbClient.notification.create({
    data: { userId: parsed.data.vendorId, type: 'ORDER', title: 'Quotation requested', body: `${user.name} requested a quotation: ${parsed.data.subject}.`, read: 0, link: '/vendor/messages', resourceId: inquiry.id },
  });
  return NextResponse.json({ success: true, inquiry }, { status: 201 });
}
