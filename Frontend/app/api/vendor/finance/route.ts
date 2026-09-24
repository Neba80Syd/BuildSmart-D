import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext, COMMISSION_RATE, CURRENCY } from '@/Backend/lib/vendor';
import { getWalletSummary, getWalletTransactions, requestWithdrawal, MIN_WITHDRAWAL_AMOUNT, MAX_WITHDRAWAL_AMOUNT } from '@/Backend/lib/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await resolveUser('VENDOR');
    const { vendorId, profile } = await getVendorContext(user.id);
    const summary = await getWalletSummary(vendorId);
    const { transactions } = await getWalletTransactions(vendorId, { limit: 20 });
    let withdrawals: any[] = [];
    try {
      withdrawals = (await dbClient.withdrawal.findMany({ where: { vendorId } })) ?? [];
    } catch (wErr) {
      console.warn('[buildsmart:finance] Withdrawals load fallback:', wErr);
    }

    return NextResponse.json({
      currency: summary?.currency || CURRENCY,
      commissionRate: COMMISSION_RATE,
      availableBalance: summary?.availableBalance ?? 0,
      escrowBalance: summary?.escrowBalance ?? 0,
      pendingWithdrawals: summary?.pendingWithdrawalBalance ?? 0,
      withdrawnAmount: summary?.withdrawnAmount ?? 0,
      totalBalance: summary?.totalBalance ?? 0,
      gross: (summary?.totalBalance ?? 0) + (summary?.withdrawnAmount ?? 0),
      net: (summary?.availableBalance ?? 0) + (summary?.escrowBalance ?? 0),
      commissions: Math.round(((summary?.totalBalance ?? 0) + (summary?.withdrawnAmount ?? 0)) * COMMISSION_RATE),
      withdrawals,
      transactions: transactions ?? [],
      minWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
      maxWithdrawalAmount: MAX_WITHDRAWAL_AMOUNT,
      taxSettings: profile?.taxSettings ?? { vatRate: 0, collectVat: false, taxNumber: '', annualStatementReady: false },
    });
  } catch (err: any) {
    console.error('[buildsmart:finance] Failed to load finance data:', err);
    return NextResponse.json({ error: err?.message ?? 'Failed to load wallet data' }, { status: 500 });
  }
}

const WithdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['MTN_MOMO', 'ORANGE_MONEY', 'BANK', 'STRIPE']).default('MTN_MOMO'),
  account: z.record(z.string(), z.any()).optional(),
  phone: z.string().optional(),
  accountName: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId } = await getVendorContext(user.id);
  const parsed = WithdrawSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });

  const { amount, method, account, phone, accountName, idempotencyKey } = parsed.data;

  // Determine destination info from payload
  const destRef = phone || account?.phone || account?.accountNumber || account?.accountId || '';
  const name = accountName || account?.accountName || user.name || 'Vendor';

  try {
    const result = await requestWithdrawal({
      vendorId,
      amount,
      method,
      destinationType: method,
      destinationReference: destRef,
      accountName: name,
      accountDetails: account,
      idempotencyKey,
    });

    return NextResponse.json({ success: true, withdrawal: result.withdrawal, isDuplicate: result.isDuplicate }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Withdrawal failed' }, { status: 400 });
  }
}

const TaxSchema = z.object({
  vatRate: z.number().min(0).max(100),
  collectVat: z.boolean(),
  taxNumber: z.string().max(60).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const { vendorId, profile } = await getVendorContext(user.id);
  if (!profile) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

  const parsed = TaxSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const updated = await dbClient.vendorProfile.update({
    where: { userId: user.id },
    data: { taxSettings: { ...(profile.taxSettings ?? {}), ...parsed.data } },
  });
  return NextResponse.json({ success: true, taxSettings: updated?.taxSettings });
}
