import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveUser } from '@/Backend/lib/preview';
import { requestArchitectWithdrawal } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

const WithdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'BANK_TRANSFER']).default('MTN_MOMO'),
  destinationReference: z.string().min(3, 'Destination account or phone number is required'),
  accountName: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    const body = await req.json().catch(() => null);
    const parsed = WithdrawSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid withdrawal payload' },
        { status: 400 }
      );
    }

    const { amount, method, destinationReference, accountName, idempotencyKey } = parsed.data;

    const result = await requestArchitectWithdrawal({
      architectId: user.id,
      amount,
      method,
      destinationReference,
      accountName: accountName || user.name || 'Architect',
      idempotencyKey,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Withdrawal processing failed' },
      { status: 400 }
    );
  }
}
