import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/Backend/lib/payment-provider';
import { dbClient } from '@/Backend/lib/db';
import { initiateDesignEscrow } from '@/Backend/lib/architect-escrow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headersObj: Record<string, string | string[] | undefined> = {};
    req.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    const body = JSON.parse(rawBody || '{}');
    const providerType = body.provider || body.channel || 'CARD';
    const provider = getPaymentProvider(providerType);

    // Cryptographic signature check
    const isValid = provider.verifyWebhookSignature(headersObj, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const { reference, providerReference, status, amount, metadata, eventType } = body;

    // Process event
    if (eventType === 'PAYMENT_SUCCESS' || status === 'SUCCESS' || status === 'COMPLETED') {
      // Check if reference maps to an existing escrow
      const existing = await dbClient.escrowTransaction.findFirst({
        where: { paymentId: providerReference || reference },
      });

      if (existing) {
        // Idempotent: already funded
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // If this was a design payment webhook with designId in metadata:
      if (metadata?.designId && metadata?.architectId && metadata?.clientId) {
        await initiateDesignEscrow({
          designId: metadata.designId,
          projectId: metadata.projectId,
          clientId: metadata.clientId,
          architectId: metadata.architectId,
          amount: Number(amount || metadata.amount || 150000),
          reference,
          paymentId: providerReference || reference,
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' });
  } catch (err: any) {
    console.error('[buildsmart:webhook] Error processing webhook:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
