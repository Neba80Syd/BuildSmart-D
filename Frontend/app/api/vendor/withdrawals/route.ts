import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';
import { requestWithdrawal } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const withdrawals = await dbClient.withdrawal.findMany({
    where: { vendorId },
    orderBy: { requestedAt: 'desc' },
  });

  return NextResponse.json({ withdrawals });
}

const WithdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'BANK', 'STRIPE']).default('MTN_MOMO'),
  phone: z.string().optional(),
  accountName: z.string().optional(),
  accountDetails: z.record(z.string(), z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);

  const parsed = WithdrawSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }

  const { amount, method, phone, accountName, accountDetails, idempotencyKey } = parsed.data;
  const destRef = phone || accountDetails?.phone || accountDetails?.accountNumber || '';
  const name = accountName || accountDetails?.accountName || user.name || 'Vendor';

  try {
    const result = await requestWithdrawal({
      vendorId,
      amount,
      method,
      destinationType: method,
      destinationReference: destRef,
      accountName: name,
      accountDetails,
      idempotencyKey,
    });

    return NextResponse.json({ success: true, withdrawal: result.withdrawal, isDuplicate: result.isDuplicate }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Withdrawal failed' }, { status: 400 });
  }
}
