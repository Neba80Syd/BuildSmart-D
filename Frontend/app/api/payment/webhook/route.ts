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

    // Detect provider type: identify Campay from webhook payload fields or headers
    const isCampay = Boolean(
      body.endpoint ||
      body.operator ||
      body.operator_reference ||
      body.signature ||
      (typeof headersObj['authorization'] === 'string' && headersObj['authorization'].includes('Token')) ||
      headersObj['x-campay-signature']
    );
    const providerType = isCampay ? 'CAMPAY' : (body.provider || body.channel || 'CARD');
    const provider = getPaymentProvider(providerType);

    // Cryptographic signature check
    const isValid = provider.verifyWebhookSignature(headersObj, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const reference = body.external_reference || body.reference;
    const providerReference = body.reference || body.providerReference;
    const rawStatus = String(body.status || body.eventType || '').toUpperCase();
    const amount = Number(body.amount || body.app_amount || 0);
    const metadata = body.metadata || {};

    const isSuccess = ['SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'PAYMENT_SUCCESS'].includes(rawStatus);

    // Process successful payment event
    if (isSuccess) {
      // 1. Update any corresponding Payment record in database
      const matchingPayment: any = await dbClient.payment.findFirst({
        where: {
          OR: [
            { id: reference },
            { id: providerReference },
            { description: { contains: reference } },
            { description: { contains: providerReference } },
          ],
        },
      }).catch(() => null);

      if (matchingPayment && matchingPayment.status !== 'SUCCEEDED') {
        await dbClient.payment.update({
          where: { id: matchingPayment.id },
          data: { status: 'SUCCEEDED' },
        }).catch(() => null);
      }

      // 2. Check if reference maps to an existing escrow transaction
      const existing = await dbClient.escrowTransaction.findFirst({
        where: {
          OR: [
            { paymentId: providerReference },
            { paymentId: reference },
          ],
        },
      });

      if (existing) {
        // Idempotent: already funded
        return NextResponse.json({ success: true, message: 'Already processed', escrowId: existing.id });
      }

      // 3. If this was an architectural design payment:
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

    return NextResponse.json({ success: true, message: 'Campay webhook processed successfully' });
  } catch (err: any) {
    console.error('[buildsmart:webhook] Error processing webhook:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
