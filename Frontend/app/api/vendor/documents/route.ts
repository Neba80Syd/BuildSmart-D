import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

const DOC_CATEGORIES = ['Invoice', 'Packing Slip', 'Commercial Invoice', 'Shipping Label', 'Tax'] as const;

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const docs = await dbClient.document.findMany({ where: { ownerId: vendorId } });
  return NextResponse.json({ documents: docs });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.enum(DOC_CATEGORIES),
  orderId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  // The "document" is generated server-side as a text artifact (packing slip /
  // commercial invoice) the vendor can download/print.
  const doc = await dbClient.document.create({
    data: {
      ownerId: vendorId,
      name: parsed.data.name,
      type: 'text/plain',
      size: 0,
      category: parsed.data.category,
      version: 1,
      content: buildArtifact(parsed.data),
    },
  });
  return NextResponse.json({ success: true, document: { ...doc, content: undefined } }, { status: 201 });
}

function buildArtifact(data: { name: string; category: string; orderId?: string }) {
  const lines = [
    'BUILDSMART AI — VENDOR DOCUMENT',
    '==============================',
    `Document: ${data.name}`,
    `Type: ${data.category}`,
    data.orderId ? `Order: ${data.orderId}` : 'Order: —',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This is a system-generated ' + data.category.toLowerCase() + '.',
    'Print this page or download it for your records.',
  ];
  return lines.join('\n');
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const doc = await dbClient.document.findUnique({ where: { id } });
  if (!doc || doc.ownerId !== vendorId) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  await dbClient.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
