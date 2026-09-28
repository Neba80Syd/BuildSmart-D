// BuildSmart AI — Campay Payment Verification & Real-time Polling Endpoint
// Allows the client UI to check real-time status of Mobile Money USSD prompt or hosted checkout

import { NextRequest, NextResponse } from 'next/server';
import { campayClient } from '@/Backend/services/campay/index';
import { dbClient } from '@/Backend/lib/db';
import { initiateDesignEscrow } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ success: false, error: 'Payment reference is required' }, { status: 400 });
    }

    const tx = await campayClient.getTransactionStatus(reference);
    const isSuccess = tx.status === 'SUCCESSFUL';
    const isFailed = tx.status === 'FAILED';

    if (isSuccess) {
      // Find matching payment record
      const payment: any = await dbClient.payment.findFirst({
        where: {
          OR: [
            { id: tx.external_reference || reference },
            { id: tx.reference },
            { description: { contains: reference } },
            { description: { contains: tx.external_reference || '' } },
          ],
        },
      }).catch(() => null);

      if (payment && payment.status !== 'SUCCEEDED') {
        await dbClient.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCEEDED' },
        }).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      verified: isSuccess,
      status: isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING',
      operator: tx.operator,
      operatorReference: tx.operator_reference,
      amount: tx.amount,
      currency: tx.currency,
      rawStatus: tx.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to verify transaction status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const reference = body.reference || body.paymentReference;

    if (!reference) {
      return NextResponse.json({ success: false, error: 'Payment reference is required' }, { status: 400 });
    }

    const tx = await campayClient.getTransactionStatus(reference);
    const isSuccess = tx.status === 'SUCCESSFUL';
    const isFailed = tx.status === 'FAILED';

    return NextResponse.json({
      success: true,
      verified: isSuccess,
      status: isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING',
      operator: tx.operator,
      amount: tx.amount,
      currency: tx.currency,
      rawStatus: tx.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to verify transaction' },
      { status: 500 }
    );
  }
}
