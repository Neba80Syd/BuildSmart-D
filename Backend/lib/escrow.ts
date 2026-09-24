// BuildSmart AI — Escrow Engine & State Machine Service.
//
// Manages the complete client-vendor escrow lifecycle:
// Payment -> Escrow Lock -> Delivery -> Inspection Window -> Release / Dispute / Refund.
// All financial state transitions are strictly validated and atomic.

import { getPrisma, attachWalletDelegates } from './db.ts';
import { lockEscrowFunds, releaseEscrowFunds, refundEscrowFunds, holdDisputeFunds, getOrCreateVendorWallet } from './wallet.ts';
import { COMMISSION_RATE, CURRENCY } from './vendor.ts';

export const DEFAULT_CONFIRMATION_DAYS = 3; // 3 days (72 hours) inspection period

export type EscrowState =
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'ESCROWED'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CLIENT_CONFIRMATION_PENDING'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PAYMENT_PENDING: ['PAID', 'ESCROWED', 'CANCELLED'],
  PAID: ['ESCROWED', 'CANCELLED', 'REFUNDED'],
  ESCROWED: ['PROCESSING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'DISPUTED'],
  PROCESSING: ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'DISPUTED'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'DISPUTED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CLIENT_CONFIRMATION_PENDING', 'DISPUTED'],
  DELIVERED: ['CLIENT_CONFIRMATION_PENDING', 'RELEASED', 'DISPUTED'],
  CLIENT_CONFIRMATION_PENDING: ['RELEASED', 'DISPUTED', 'EXPIRED'],
  DISPUTED: ['RELEASED', 'REFUNDED', 'CLIENT_CONFIRMATION_PENDING'],
  REFUND_PENDING: ['REFUNDED', 'CANCELLED'],
  RELEASED: [], // Terminal
  REFUNDED: [], // Terminal
  CANCELLED: [], // Terminal
  EXPIRED: ['RELEASED'],
};

function newId(prefix = 'esc') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validates that an escrow state transition is permissible.
 */
export function validateStateTransition(current: string, next: string): void {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid escrow state transition: cannot transition from ${current} to ${next}`);
  }
}

/**
 * Retrieve the configured client confirmation period in days from platform settings,
 * falling back to DEFAULT_CONFIRMATION_DAYS.
 */
export async function getConfirmationPeriodDays(): Promise<number> {
  try {
    const prisma = await getPrisma();
    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'escrow.confirmation_period_days' },
    });
    if (setting?.value) {
      const val = typeof setting.value === 'number' ? setting.value : Number(setting.value);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_CONFIRMATION_DAYS;
}

/**
 * Initiates an escrow transaction when an order is paid.
 * Locks the net vendor amount in the vendor wallet's escrow balance.
 */
export async function initiateOrderEscrow(params: {
  orderId: string;
  clientId: string;
  paymentId?: string;
  commissionRate?: number;
}) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const order = await tx.order.findUnique({ where: { id: params.orderId } });
    if (!order) throw new Error(`Order ${params.orderId} not found`);

    const orderItems = await tx.orderItem.findMany({ where: { orderId: params.orderId } });
    if (orderItems.length === 0) throw new Error(`Order ${params.orderId} has no items`);

    const productIds = orderItems.map((it: any) => it.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Group items by vendor
    const itemsByVendor = new Map<string, any[]>();
    for (const item of orderItems) {
      const prod = productMap.get(item.productId) as any;
      const vendorId = prod?.vendorId ?? 'u_vendor';
      if (!itemsByVendor.has(vendorId)) itemsByVendor.set(vendorId, []);
      itemsByVendor.get(vendorId)!.push(item);
    }

    const rate = params.commissionRate ?? COMMISSION_RATE;
    const createdEscrows: any[] = [];

    for (const [vendorId, items] of itemsByVendor.entries()) {
      const gross = items.reduce((sum: number, it: any) => sum + Number(it.total || 0), 0);
      const fee = Math.round(gross * rate);
      const netVendor = gross - fee;

      // Check if an escrow already exists for this order & vendor
      const existing = await tx.escrowTransaction.findFirst({
        where: { orderId: params.orderId, vendorId },
      });
      if (existing) {
        createdEscrows.push(existing);
        continue;
      }

      // Lock funds in vendor's wallet
      const { wallet } = await lockEscrowFunds(tx, {
        vendorId,
        orderId: params.orderId,
        amount: netVendor,
        fee,
        grossAmount: gross,
        reference: params.paymentId ?? params.orderId,
        description: `Payment secured in escrow for Order #${params.orderId}`,
      });

      // Create Escrow record
      const escrow = await tx.escrowTransaction.create({
        data: {
          id: newId('esc'),
          orderId: params.orderId,
          walletId: wallet.id,
          vendorId,
          clientId: params.clientId,
          paymentId: params.paymentId ?? null,
          amount: netVendor,
          platformFee: fee,
          grossAmount: gross,
          currency: order.currency || CURRENCY,
          status: 'ESCROWED',
          fundedAt: new Date(),
          autoReleaseEligible: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      createdEscrows.push(escrow);

      // In-app notification to vendor
      await tx.notification.create({
        data: {
          id: newId('notif'),
          userId: vendorId,
          type: 'PAYMENT',
          title: 'Payment Secured in Escrow',
          body: `New paid order #${params.orderId}! ${netVendor.toLocaleString()} ${CURRENCY} is safely secured in escrow and will be released upon delivery confirmation.`,
          read: false,
          link: '/vendor/orders',
          resourceId: params.orderId,
          createdAt: new Date(),
        },
      });
    }

    // Update order escrowStatus
    try {
      await tx.order.update({
        where: { id: params.orderId },
        data: {
          escrowStatus: 'ESCROWED',
          status: order.status === 'PENDING' ? 'PROCESSING' : order.status,
        },
      });
    } catch (e: any) {
      if (/escrowStatus/i.test(e?.message ?? '')) {
        await tx.order.update({
          where: { id: params.orderId },
          data: {
            status: order.status === 'PENDING' ? 'PROCESSING' : order.status,
          },
        });
      } else {
        throw e;
      }
    }

    // In-app notification to client
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: params.clientId,
        type: 'PAYMENT',
        title: 'Payment Secured with BuildSmart Escrow',
        body: `Your payment of ${order.totalAmount.toLocaleString()} ${CURRENCY} for Order #${params.orderId} is safely held in escrow. Funds are only released after you inspect and confirm delivery.`,
        read: false,
        link: '/client/orders',
        resourceId: params.orderId,
        createdAt: new Date(),
      },
    });

    return createdEscrows;
  });
}

/**
 * Vendor marks an order as DELIVERED.
 * Begins the inspection/confirmation countdown for the client.
 */
export async function markOrderDelivered(params: { orderId: string; vendorId: string }) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);
  const confirmationDays = await getConfirmationPeriodDays();

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const escrow = await tx.escrowTransaction.findFirst({
      where: { orderId: params.orderId, vendorId: params.vendorId },
    });
    if (!escrow) throw new Error(`Escrow transaction not found for Order ${params.orderId}`);

    if (escrow.status === 'RELEASED') throw new Error('Escrow has already been released');
    if (escrow.status === 'REFUNDED') throw new Error('Escrow has already been refunded');
    if (escrow.status === 'DISPUTED') throw new Error('Cannot mark delivered while a dispute is active');

    const now = new Date();
    const deadline = new Date(now.getTime() + confirmationDays * 86400000);

    const updatedEscrow = await tx.escrowTransaction.update({
      where: { id: escrow.id },
      data: {
        status: 'CLIENT_CONFIRMATION_PENDING',
        deliveredAt: now,
        confirmationDeadline: deadline,
        updatedAt: now,
      },
    });

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: 'DELIVERED',
        escrowStatus: 'CLIENT_CONFIRMATION_PENDING',
        fulfilledAt: now,
        confirmationDeadline: deadline,
      },
    });

    // Notify client to inspect products and confirm
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: escrow.clientId,
        type: 'ORDER',
        title: 'Order Delivered — Confirmation Required',
        body: `Your order #${params.orderId} was marked as delivered. Please inspect your items and confirm delivery by ${deadline.toLocaleDateString()} to release escrow funds, or report an issue.`,
        read: false,
        link: '/client/orders',
        resourceId: params.orderId,
        createdAt: now,
      },
    });

    // Record audit event
    await tx.auditLog.create({
      data: {
        id: newId('audit'),
        actorId: params.vendorId,
        actorName: 'Vendor',
        action: 'ORDER_MARKED_DELIVERED',
        resource: 'ORDER',
        resourceId: params.orderId,
        result: 'SUCCESS',
        reason: `Delivery recorded; confirmation deadline set to ${deadline.toISOString()}`,
        ip: '127.0.0.1',
        createdAt: now,
      },
    });

    return { escrow: updatedEscrow, deadline };
  });
}

/**
 * Client confirms delivery.
 * Atomically releases escrow funds into vendor available balance.
 */
export async function confirmDelivery(params: { orderId: string; clientId: string }) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const escrow = await tx.escrowTransaction.findFirst({
      where: { orderId: params.orderId },
    });
    if (!escrow) throw new Error(`Escrow record not found for Order ${params.orderId}`);

    // Verify ownership
    if (escrow.clientId !== params.clientId) {
      throw new Error('Forbidden: You do not own this order');
    }

    // Idempotency: if already released, return existing state
    if (escrow.status === 'RELEASED') {
      return { alreadyReleased: true, escrow };
    }

    if (escrow.status === 'REFUNDED') {
      throw new Error('Cannot release escrow: order was previously refunded');
    }
    if (escrow.status === 'DISPUTED') {
      throw new Error('Cannot release escrow: a dispute is actively under investigation');
    }

    const now = new Date();

    // Release funds into vendor wallet
    const { wallet, transaction } = await releaseEscrowFunds(tx, {
      vendorId: escrow.vendorId,
      orderId: params.orderId,
      amount: escrow.amount,
      reference: escrow.id,
      description: `Client confirmed delivery for Order #${params.orderId}`,
    });

    const updatedEscrow = await tx.escrowTransaction.update({
      where: { id: escrow.id },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        updatedAt: now,
      },
    });

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: 'DELIVERED',
        escrowStatus: 'RELEASED',
      },
    });

    // Notify vendor
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: escrow.vendorId,
        type: 'PAYMENT',
        title: 'Escrow Released — Funds Available!',
        body: `Client confirmed delivery of Order #${params.orderId}. ${escrow.amount.toLocaleString()} ${CURRENCY} is now available in your wallet for withdrawal.`,
        read: false,
        link: '/vendor/earnings',
        resourceId: params.orderId,
        createdAt: now,
      },
    });

    // Notify client
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: params.clientId,
        type: 'ORDER',
        title: 'Delivery Confirmed',
        body: `Thank you for confirming delivery of Order #${params.orderId}. Escrow payment has been released to the vendor.`,
        read: false,
        link: '/client/orders',
        resourceId: params.orderId,
        createdAt: now,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        id: newId('audit'),
        actorId: params.clientId,
        actorName: 'Client',
        action: 'ESCROW_RELEASED_BY_CLIENT',
        resource: 'ESCROW',
        resourceId: escrow.id,
        result: 'SUCCESS',
        reason: `Client confirmed delivery of order #${params.orderId}; ${escrow.amount} ${CURRENCY} released to vendor ${escrow.vendorId}`,
        ip: '127.0.0.1',
        createdAt: now,
      },
    });

    return { alreadyReleased: false, escrow: updatedEscrow, transaction, wallet };
  });
}

/**
 * Client opens a dispute for an order.
 * Puts escrow on DISPUTE_HOLD and creates an open dispute case.
 */
export async function openDispute(params: {
  orderId: string;
  clientId: string;
  reason: string;
  description: string;
  evidence?: any[];
}) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const escrow = await tx.escrowTransaction.findFirst({
      where: { orderId: params.orderId },
    });
    if (!escrow) throw new Error(`Escrow record not found for Order ${params.orderId}`);

    if (escrow.clientId !== params.clientId) {
      throw new Error('Forbidden: You do not own this order');
    }

    if (escrow.status === 'RELEASED') {
      throw new Error('Cannot open dispute: funds have already been released to the vendor');
    }
    if (escrow.status === 'REFUNDED') {
      throw new Error('Cannot open dispute: order has already been refunded');
    }
    if (escrow.status === 'DISPUTED') {
      throw new Error('A dispute is already open for this order');
    }

    const now = new Date();
    const disputeId = newId('disp');

    // Update escrow to DISPUTED
    const updatedEscrow = await tx.escrowTransaction.update({
      where: { id: escrow.id },
      data: {
        status: 'DISPUTED',
        disputedAt: now,
        updatedAt: now,
      },
    });

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        escrowStatus: 'DISPUTED',
      },
    });

    // Record DISPUTE_HOLD in vendor's wallet ledger
    await holdDisputeFunds(tx, {
      vendorId: escrow.vendorId,
      orderId: params.orderId,
      disputeId,
      amount: escrow.amount,
      reference: params.orderId,
      reason: params.reason,
    });

    // Create Dispute record
    const dispute = await tx.dispute.create({
      data: {
        id: disputeId,
        orderId: params.orderId,
        escrowId: escrow.id,
        vendorId: escrow.vendorId,
        clientId: params.clientId,
        title: `Dispute on Order #${params.orderId}: ${params.reason}`,
        category: 'Order Dispute',
        priority: 'HIGH',
        status: 'OPEN',
        reason: params.reason,
        description: params.description,
        evidence: params.evidence ?? [],
        amount: escrow.grossAmount,
        parties: [
          { id: params.clientId, role: 'CLIENT' },
          { id: escrow.vendorId, role: 'VENDOR' },
        ],
        timeline: [
          {
            at: now.toISOString(),
            actor: 'Client',
            action: 'DISPUTE_OPENED',
            reason: params.reason,
            text: params.description,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    });

    // Notify vendor
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: escrow.vendorId,
        type: 'ORDER',
        title: 'Dispute Opened on Order #' + params.orderId,
        body: `The client reported an issue (${params.reason}). Escrow funds have been temporarily held. Please submit your response and delivery proof in the Vendor Portal.`,
        read: false,
        link: '/vendor/orders',
        resourceId: disputeId,
        createdAt: now,
      },
    });

    // Notify admin
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: 'u_admin',
        type: 'SYSTEM',
        title: 'New Dispute Filed',
        body: `Order #${params.orderId} has been disputed by client (${params.reason}). Escrow amount: ${escrow.amount.toLocaleString()} ${CURRENCY}.`,
        read: false,
        link: '/admin/disputes',
        resourceId: disputeId,
        createdAt: now,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        id: newId('audit'),
        actorId: params.clientId,
        actorName: 'Client',
        action: 'DISPUTE_CREATED',
        resource: 'ORDER',
        resourceId: params.orderId,
        result: 'SUCCESS',
        reason: `Dispute opened for order #${params.orderId} (${params.reason}): ${params.description}`,
        ip: '127.0.0.1',
        createdAt: now,
      },
    });

    return { dispute, escrow: updatedEscrow };
  });
}

/**
 * Vendor submits response and evidence to an open dispute.
 */
export async function respondToDispute(params: {
  disputeId: string;
  vendorId: string;
  response: string;
  evidence?: any[];
}) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const dispute = await tx.dispute.findUnique({ where: { id: params.disputeId } });
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.vendorId !== params.vendorId) throw new Error('Forbidden: Not your dispute');

    const now = new Date();
    const timeline = Array.isArray(dispute.timeline) ? dispute.timeline : [];
    timeline.push({
      at: now.toISOString(),
      actor: 'Vendor',
      action: 'VENDOR_RESPONSE',
      text: params.response,
    });

    const updated = await tx.dispute.update({
      where: { id: params.disputeId },
      data: {
        status: 'UNDER_REVIEW',
        vendorResponse: params.response,
        vendorEvidence: params.evidence ?? [],
        vendorRespondedAt: now,
        timeline,
        updatedAt: now,
      },
    });

    // Notify admin
    await tx.notification.create({
      data: {
        id: newId('notif'),
        userId: 'u_admin',
        type: 'SYSTEM',
        title: 'Vendor Responded to Dispute',
        body: `Vendor submitted evidence for dispute on Order #${dispute.orderId}. Ready for admin review.`,
        read: false,
        link: '/admin/disputes',
        resourceId: params.disputeId,
        createdAt: now,
      },
    });

    return updated;
  });
}

/**
 * Administrator resolves a dispute.
 * Supported resolutions:
 * - RELEASE_VENDOR: full escrow released to vendor
 * - REFUND_CLIENT: full escrow refunded to client
 * - PARTIAL: specified amount refunded to client, remainder released to vendor
 */
export async function resolveDispute(params: {
  disputeId: string;
  adminId: string;
  adminName: string;
  resolutionType: 'RELEASE_VENDOR' | 'REFUND_CLIENT' | 'PARTIAL';
  resolutionNote: string;
  clientRefundAmount?: number;
  vendorReleaseAmount?: number;
}) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const dispute = await tx.dispute.findUnique({ where: { id: params.disputeId } });
    if (!dispute) throw new Error('Dispute not found');
    if (['RESOLVED_FOR_VENDOR', 'RESOLVED_FOR_CLIENT', 'CLOSED', 'RESOLVED'].includes(dispute.status)) {
      throw new Error('Dispute has already been resolved');
    }

    const escrow = await tx.escrowTransaction.findUnique({ where: { id: dispute.escrowId } });
    if (!escrow) throw new Error('Associated escrow record not found');

    const now = new Date();
    const timeline = Array.isArray(dispute.timeline) ? dispute.timeline : [];

    if (params.resolutionType === 'RELEASE_VENDOR') {
      // Release full escrow to vendor
      await releaseEscrowFunds(tx, {
        vendorId: escrow.vendorId,
        orderId: escrow.orderId,
        amount: escrow.amount,
        reference: dispute.id,
        description: `Admin resolved dispute in vendor favor. ${params.resolutionNote}`,
      });

      await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: 'RELEASED', releasedAt: now, updatedAt: now },
      });

      await tx.order.update({
        where: { id: escrow.orderId },
        data: { escrowStatus: 'RELEASED' },
      });

      timeline.push({
        at: now.toISOString(),
        actor: `Admin (${params.adminName})`,
        action: 'RESOLVED_FOR_VENDOR',
        text: `Full funds released to vendor: ${params.resolutionNote}`,
      });

      await tx.dispute.update({
        where: { id: params.disputeId },
        data: {
          status: 'RESOLVED_FOR_VENDOR',
          resolutionType: 'RELEASE_VENDOR',
          resolution: params.resolutionNote,
          releaseAmount: escrow.amount,
          refundAmount: 0,
          resolvedAt: now,
          resolvedBy: params.adminId,
          timeline,
          updatedAt: now,
        },
      });

      // Notifications
      await tx.notification.create({
        data: {
          id: newId('notif'),
          userId: escrow.vendorId,
          type: 'PAYMENT',
          title: 'Dispute Resolved in Your Favor',
          body: `The dispute on Order #${escrow.orderId} was resolved. ${escrow.amount.toLocaleString()} ${CURRENCY} was released to your available balance.`,
          read: false,
          link: '/vendor/earnings',
          resourceId: dispute.id,
          createdAt: now,
        },
      });

      await tx.notification.create({
        data: {
          id: newId('notif'),
          userId: dispute.clientId,
          type: 'ORDER',
          title: 'Dispute Resolved',
          body: `The dispute on Order #${escrow.orderId} was reviewed by administration and resolved: ${params.resolutionNote}`,
          read: false,
          link: '/client/orders',
          resourceId: dispute.id,
          createdAt: now,
        },
      });
    } else if (params.resolutionType === 'REFUND_CLIENT') {
      // Refund client from escrow
      await refundEscrowFunds(tx, {
        vendorId: escrow.vendorId,
        orderId: escrow.orderId,
        disputeId: dispute.id,
        amount: escrow.amount,
        reference: dispute.id,
        reason: params.resolutionNote,
      });

      await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: 'REFUNDED', refundedAt: now, updatedAt: now },
      });

      await tx.order.update({
        where: { id: escrow.orderId },
        data: { status: 'REFUNDED', escrowStatus: 'REFUNDED' },
      });

      // Update / create refund record in payment table
      await tx.payment.create({
        data: {
          id: newId('pay_ref'),
          userId: dispute.clientId,
          amount: escrow.grossAmount,
          currency: escrow.currency || CURRENCY,
          status: 'REFUNDED',
          description: `Dispute refund for Order #${escrow.orderId}: ${params.resolutionNote}`,
          createdAt: now,
        },
      });

      timeline.push({
        at: now.toISOString(),
        actor: `Admin (${params.adminName})`,
        action: 'RESOLVED_FOR_CLIENT',
        text: `Full refund issued to client: ${params.resolutionNote}`,
      });

      await tx.dispute.update({
        where: { id: params.disputeId },
        data: {
          status: 'RESOLVED_FOR_CLIENT',
          resolutionType: 'REFUND_CLIENT',
          resolution: params.resolutionNote,
          refundAmount: escrow.grossAmount,
          releaseAmount: 0,
          resolvedAt: now,
          resolvedBy: params.adminId,
          timeline,
          updatedAt: now,
        },
      });

      // Notifications
      await tx.notification.create({
        data: {
          id: newId('notif'),
          userId: dispute.clientId,
          type: 'PAYMENT',
          title: 'Refund Approved for Order #' + escrow.orderId,
          body: `Your dispute was resolved in your favor. A full refund of ${escrow.grossAmount.toLocaleString()} ${CURRENCY} has been credited.`,
          read: false,
          link: '/client/orders',
          resourceId: dispute.id,
          createdAt: now,
        },
      });

      await tx.notification.create({
        data: {
          id: newId('notif'),
          userId: escrow.vendorId,
          type: 'ORDER',
          title: 'Dispute Resolved — Refund Issued',
          body: `The dispute on Order #${escrow.orderId} was resolved in client favor: ${params.resolutionNote}. Escrow funds have been refunded.`,
          read: false,
          link: '/vendor/orders',
          resourceId: dispute.id,
          createdAt: now,
        },
      });
    } else if (params.resolutionType === 'PARTIAL') {
      const clientRefund = params.clientRefundAmount ?? 0;
      const vendorRelease = params.vendorReleaseAmount ?? 0;

      if (clientRefund + vendorRelease <= 0) {
        throw new Error('Partial resolution must specify non-zero refund or release amounts');
      }

      // Deduct full escrow from escrowBalance
      const wallet = await getOrCreateVendorWallet(escrow.vendorId, tx);
      const currentEscrow = Number(wallet.escrowBalance || 0);
      const currentAvailable = Number(wallet.availableBalance || 0);

      const newEscrow = Math.max(0, currentEscrow - escrow.amount);
      const newAvailable = currentAvailable + vendorRelease;

      await tx.vendorWallet.update({
        where: { id: wallet.id },
        data: {
          escrowBalance: newEscrow,
          availableBalance: newAvailable,
          updatedAt: now,
        },
      });

      if (vendorRelease > 0) {
        await tx.walletTransaction.create({
          data: {
            id: newId('wtx'),
            walletId: wallet.id,
            vendorId: escrow.vendorId,
            orderId: escrow.orderId,
            disputeId: dispute.id,
            transactionType: 'ESCROW_RELEASED',
            amount: vendorRelease,
            fee: 0,
            netAmount: vendorRelease,
            currency: escrow.currency || CURRENCY,
            status: 'COMPLETED',
            balanceBefore: currentAvailable,
            balanceAfter: newAvailable,
            reference: dispute.id,
            description: `Partial dispute settlement release on Order #${escrow.orderId}: ${params.resolutionNote}`,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      if (clientRefund > 0) {
        await tx.walletTransaction.create({
          data: {
            id: newId('wtx'),
            walletId: wallet.id,
            vendorId: escrow.vendorId,
            orderId: escrow.orderId,
            disputeId: dispute.id,
            transactionType: 'REFUND',
            amount: -clientRefund,
            fee: 0,
            netAmount: -clientRefund,
            currency: escrow.currency || CURRENCY,
            status: 'COMPLETED',
            balanceBefore: currentEscrow,
            balanceAfter: newEscrow,
            reference: dispute.id,
            description: `Partial dispute settlement refund on Order #${escrow.orderId}`,
            createdAt: now,
            updatedAt: now,
          },
        });

        await tx.payment.create({
          data: {
            id: newId('pay_ref'),
            userId: dispute.clientId,
            amount: clientRefund,
            currency: escrow.currency || CURRENCY,
            status: 'REFUNDED',
            description: `Partial dispute refund for Order #${escrow.orderId}: ${params.resolutionNote}`,
            createdAt: now,
          },
        });
      }

      await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: 'RELEASED', releasedAt: now, updatedAt: now },
      });

      await tx.order.update({
        where: { id: escrow.orderId },
        data: { escrowStatus: 'RELEASED' },
      });

      timeline.push({
        at: now.toISOString(),
        actor: `Admin (${params.adminName})`,
        action: 'PARTIAL_RESOLUTION',
        text: `Partial resolution: ${clientRefund} ${CURRENCY} refunded to client, ${vendorRelease} ${CURRENCY} released to vendor. Note: ${params.resolutionNote}`,
      });

      await tx.dispute.update({
        where: { id: params.disputeId },
        data: {
          status: 'PARTIAL_RESOLUTION',
          resolutionType: 'PARTIAL',
          resolution: params.resolutionNote,
          refundAmount: clientRefund,
          releaseAmount: vendorRelease,
          resolvedAt: now,
          resolvedBy: params.adminId,
          timeline,
          updatedAt: now,
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        id: newId('audit'),
        actorId: params.adminId,
        actorName: params.adminName,
        action: `DISPUTE_RESOLVED_${params.resolutionType}`,
        resource: 'DISPUTE',
        resourceId: params.disputeId,
        result: 'SUCCESS',
        reason: params.resolutionNote,
        ip: '127.0.0.1',
        createdAt: now,
      },
    });

    return { success: true };
  });
}

/**
 * Scheduled/Triggered auto-release worker.
 * Checks for orders in CLIENT_CONFIRMATION_PENDING where confirmation deadline has passed
 * and no open dispute exists. Atomically releases funds to the vendor.
 */
export async function processExpiredEscrows() {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);
  const now = new Date();

  const candidates = await prisma.escrowTransaction.findMany({
    where: {
      status: 'CLIENT_CONFIRMATION_PENDING',
      confirmationDeadline: { lte: now },
      autoReleaseEligible: true,
    },
  });

  const results: any[] = [];

  for (const escrow of candidates) {
    try {
      // Check if an open dispute exists
      const openDispute = await prisma.dispute.findFirst({
        where: {
          orderId: escrow.orderId,
          status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'ESCALATED'] },
        },
      });

      const vendorId = escrow.vendorId;
      const orderId = escrow.orderId;
      if (openDispute || !vendorId || !orderId) {
        // Freeze: do not auto-release if a dispute is open or not a vendor escrow
        continue;
      }

      const releaseResult = await prisma.$transaction(async (tx: any) => {
        const { wallet, transaction } = await releaseEscrowFunds(tx, {
          vendorId,
          orderId,
          amount: escrow.amount,
          reference: escrow.id,
          description: `Auto-released after client confirmation window (${DEFAULT_CONFIRMATION_DAYS} days) expired with no dispute.`,
        });

        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            status: 'RELEASED',
            releasedAt: now,
            updatedAt: now,
          },
        });

        await tx.order.update({
          where: { id: escrow.orderId },
          data: {
            escrowStatus: 'RELEASED',
          },
        });

        // Notifications
        await tx.notification.create({
          data: {
            id: newId('notif'),
            userId: escrow.vendorId,
            type: 'PAYMENT',
            title: 'Escrow Auto-Released to Your Balance',
            body: `The inspection period for Order #${escrow.orderId} concluded without dispute. ${escrow.amount.toLocaleString()} ${CURRENCY} was automatically released to your available balance.`,
            read: false,
            link: '/vendor/earnings',
            resourceId: escrow.orderId,
            createdAt: now,
          },
        });

        await tx.notification.create({
          data: {
            id: newId('notif'),
            userId: escrow.clientId,
            type: 'ORDER',
            title: 'Order Completed Automatically',
            body: `Order #${escrow.orderId} has completed and escrow has been released to the vendor following the expiration of the inspection window.`,
            read: false,
            link: '/client/orders',
            resourceId: escrow.orderId,
            createdAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            id: newId('audit'),
            actorId: 'SYSTEM',
            actorName: 'Escrow Auto-Release Worker',
            action: 'ESCROW_AUTO_RELEASED',
            resource: 'ESCROW',
            resourceId: escrow.id,
            result: 'SUCCESS',
            reason: `Confirmation deadline expired at ${escrow.confirmationDeadline?.toISOString()}; no dispute filed. Released ${escrow.amount} ${CURRENCY}.`,
            ip: '127.0.0.1',
            createdAt: now,
          },
        });

        return { orderId: escrow.orderId, amount: escrow.amount, vendorId: escrow.vendorId };
      });

      results.push(releaseResult);
    } catch (err: any) {
      console.error(`[buildsmart:escrow] Auto-release error on escrow ${escrow.id}:`, err.message);
    }
  }

  return { processed: results.length, releases: results };
}

export async function getPlatformEscrowSummary() {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);
  const allEscrows = await prisma.escrowTransaction.findMany();
  const disputes = await prisma.dispute.findMany();
  const wallets = await prisma.vendorWallet.findMany();

  const activeEscrow = allEscrows.filter((e: any) =>
    ['ESCROWED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLIENT_CONFIRMATION_PENDING'].includes(e.status)
  );
  const disputedEscrow = allEscrows.filter((e: any) => e.status === 'DISPUTED');
  const releasedEscrow = allEscrows.filter((e: any) => e.status === 'RELEASED');
  const refundedEscrow = allEscrows.filter((e: any) => e.status === 'REFUNDED');

  return {
    totalEscrows: allEscrows.length,
    activeCount: activeEscrow.length,
    disputeCount: disputedEscrow.length,
    releasedCount: releasedEscrow.length,
    refundedCount: refundedEscrow.length,
    totalEscrowLocked: activeEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalReleasedAmount: releasedEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalRefundedAmount: refundedEscrow.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    totalWallets: wallets.length,
    currency: CURRENCY,
  };
}

