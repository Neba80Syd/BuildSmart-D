// BuildSmart AI — Campay Gateway Management & Direct Payment Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { campayClient } from '@/Backend/services/campay/index';
import { getSessionUser } from '@/Backend/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const config = campayClient.getConfig();
    const balance = await campayClient.getBalance().catch((err) => ({
      error: err.message,
      total_balance: 0,
      currency: 'XAF',
    }));

    return NextResponse.json({
      success: true,
      provider: 'CAMPAY',
      environment: config.isDemo ? 'demo' : 'production',
      baseUrl: config.baseUrl,
      hasToken: Boolean(config.token),
      balance,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve Campay gateway status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { amount, phone, description, mode } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Valid payment amount is required' }, { status: 400 });
    }

    const ref = `campay_pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (mode === 'link' || !phone) {
      const linkRes = await campayClient.getPaymentLink({
        amount: Number(amount),
        description: description || 'BuildSmart Payment',
        externalReference: ref,
      });

      return NextResponse.json({
        success: true,
        reference: ref,
        providerReference: linkRes.reference,
        paymentLink: linkRes.link,
        mode: 'hosted_link',
      });
    }

    // Direct USSD collection
    const collectRes = await campayClient.collect({
      amount: Number(amount),
      from: phone,
      description: description || 'BuildSmart Payment',
      externalReference: ref,
    });

    const operator = collectRes.operator || campayClient.detectOperator(phone);

    return NextResponse.json({
      success: true,
      reference: ref,
      providerReference: collectRes.reference,
      ussdCode: collectRes.ussd_code || (operator === 'ORANGE' ? '#150*50#' : '*126#'),
      operator,
      instructions: `USSD push prompt sent to ${phone}. Enter PIN to authorize.`,
      mode: 'ussd_collect',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Payment initiation failed' },
      { status: 400 }
    );
  }
}
