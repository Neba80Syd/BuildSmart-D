import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext, CURRENCY } from '@/Backend/lib/vendor';
import { depositToVendorWallet, MIN_DEPOSIT_AMOUNT, MAX_DEPOSIT_AMOUNT } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

const DepositSchema = z.object({
  amount: z.number().min(MIN_DEPOSIT_AMOUNT, `Minimum deposit amount is ${MIN_DEPOSIT_AMOUNT.toLocaleString()} ${CURRENCY}`),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'CARD', 'BANK_TRANSFER']).default('MTN_MOMO'),
  phone: z.string().optional(),
  destinationReference: z.string().optional(),
  accountName: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('VENDOR');
    const { vendorId } = await getVendorContext(user.id);
    const body = await req.json().catch(() => null);
    const parsed = DepositSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid deposit payload' },
        { status: 400 }
      );
    }

    const { amount, method, phone, destinationReference, accountName, paymentReference, notes, idempotencyKey } = parsed.data;

    const result = await depositToVendorWallet({
      vendorId,
      amount,
      method,
      phone: phone || destinationReference,
      accountName: accountName || user.name || 'Vendor',
      paymentReference,
      notes,
      idempotencyKey,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process deposit' },
      { status: 400 }
    );
  }
}
