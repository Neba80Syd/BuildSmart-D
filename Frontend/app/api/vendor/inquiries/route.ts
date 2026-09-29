import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

async function enrich(inquiries: any[]) {
  const users = await dbClient.user.findMany();
  const nameByUser: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name ?? 'Customer']));
  return inquiries.map((i) => ({ ...i, customerName: nameByUser[i.userId] ?? 'Customer' }));
}

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const inquiries = await dbClient.inquiry.findMany({ where: { vendorId } });
  return NextResponse.json({ inquiries: await enrich(inquiries) });
}

const ReplySchema = z.object({
  id: z.string(),
  reply: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = ReplySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const inquiry = await dbClient.inquiry.findUnique({ where: { id: parsed.data.id } });
  if (!inquiry || inquiry.vendorId !== vendorId) return NextResponse.json({ error: 'Inquiry not found or not yours' }, { status: 404 });

  const messages = Array.isArray(inquiry.messages) ? [...inquiry.messages] : [];
  messages.push({ from: 'vendor', at: new Date().toISOString(), text: parsed.data.reply });

  const updated = await dbClient.inquiry.update({ where: { id: inquiry.id }, data: { messages, status: 'OPEN' } });
  return NextResponse.json({ success: true, inquiry: updated });
}

const StatusSchema = z.object({ id: z.string(), status: z.enum(['OPEN', 'RESOLVED']) });

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = StatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const inquiry = await dbClient.inquiry.findUnique({ where: { id: parsed.data.id } });
  if (!inquiry || inquiry.vendorId !== vendorId) return NextResponse.json({ error: 'Inquiry not found or not yours' }, { status: 404 });

  const updated = await dbClient.inquiry.update({ where: { id: inquiry.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ success: true, inquiry: updated });
}
