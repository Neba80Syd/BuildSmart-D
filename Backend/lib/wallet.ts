// BuildSmart AI — Vendor Wallet & Ledger Service.
//
// Implements an immutable double-entry style financial ledger.
// All balance movements are atomic, validated server-side, and recorded as
// WalletTransaction entries. Direct frontend balance mutations are strictly prohibited.

import { getPrisma, attachWalletDelegates } from './db.ts';
import { COMMISSION_RATE, CURRENCY } from './vendor.ts';

export const MIN_WITHDRAWAL_AMOUNT = 1000; // 1,000 XAF
export const MAX_WITHDRAWAL_AMOUNT = 5000000; // 5,000,000 XAF
export const MIN_DEPOSIT_AMOUNT = 500; // 500 XAF
export const MAX_DEPOSIT_AMOUNT = 10000000; // 10,000,000 XAF
export const SUPPORTED_PAYOUT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'BANK_TRANSFER'] as const;
export const SUPPORTED_DEPOSIT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CARD', 'BANK_TRANSFER'] as const;

export type PayoutMethod = (typeof SUPPORTED_PAYOUT_METHODS)[number];

export type WalletSummary = {
  id: string;
  vendorId: string;
  currency: string;
  availableBalance: number;
  escrowBalance: number;
  pendingWithdrawalBalance: number;
  withdrawnAmount: number;
  totalBalance: number;
  createdAt: Date;
  updatedAt: Date;
};

function newId(prefix = 'tx') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ensures a vendor wallet exists for the given vendorId.
 * Creates one with zeroed balances if not present.
 */
export async function getOrCreateVendorWallet(vendorId: string, tx?: any): Promise<any> {
  const prisma = tx ?? (await getPrisma());
  attachWalletDelegates(prisma);
  let wallet = await prisma.vendorWallet.findUnique({ where: { vendorId } });
  if (!wallet) {
    wallet = await prisma.vendorWallet.create({
      data: {
        id: newId('w'),
        vendorId,
        currency: CURRENCY,
        availableBalance: 0,
        escrowBalance: 0,
        pendingWithdrawalBalance: 0,
        withdrawnAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  return wallet;
}

/**
 * Returns wallet balances and derived totals.
 */
export async function getWalletSummary(vendorId: string): Promise<WalletSummary> {
  const wallet = await getOrCreateVendorWallet(vendorId);
  const available = Math.max(0, Number(wallet.availableBalance || 0));
  const escrow = Math.max(0, Number(wallet.escrowBalance || 0));
  const pending = Math.max(0, Number(wallet.pendingWithdrawalBalance || 0));
  const withdrawn = Math.max(0, Number(wallet.withdrawnAmount || 0));

  return {
    id: wallet.id,
    vendorId: wallet.vendorId,
    currency: wallet.currency || CURRENCY,
    availableBalance: available,
    escrowBalance: escrow,
    pendingWithdrawalBalance: pending,
    withdrawnAmount: withdrawn,
    totalBalance: available + escrow + pending,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

/**
 * Query ledger transactions for a vendor's wallet.
 */
export async function getWalletTransactions(
  vendorId: string,
  options: { limit?: number; offset?: number; type?: string } = {}
) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);
  const where: any = { vendorId };
  if (options.type && options.type !== 'ALL') {
    where.transactionType = options.type;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return { transactions, total };
}

/**
 * Locks funds into the vendor's escrow balance upon verified customer payment.
 */
export async function lockEscrowFunds(
  prisma: any,
  params: {
    vendorId: string;
    orderId: string;
    amount: number; // Net vendor amount
    fee: number; // Platform fee
    grossAmount: number;
    reference: string;
    description?: string;
  }
) {
  attachWalletDelegates(prisma);
  const wallet = await getOrCreateVendorWallet(params.vendorId, prisma);
  const before = Number(wallet.escrowBalance || 0);
  const after = before + params.amount;

  const updatedWallet = await prisma.vendorWallet.update({
    where: { id: wallet.id },
    data: {
      escrowBalance: after,
      updatedAt: new Date(),
    },
  });

  const tx = await prisma.walletTransaction.create({
    data: {
      id: newId('wtx'),
      walletId: wallet.id,
      vendorId: params.vendorId,
      orderId: params.orderId,
      transactionType: 'ESCROW_LOCKED',
      amount: params.amount,
      fee: params.fee,
      netAmount: params.amount,
      currency: wallet.currency || CURRENCY,
      status: 'COMPLETED',
      balanceBefore: before,
      balanceAfter: after,
      reference: params.reference,
      description: params.description ?? `Funds locked in escrow for Order #${params.orderId}`,
      metadata: { grossAmount: params.grossAmount, fee: params.fee },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return { wallet: updatedWallet, transaction: tx };
}

/**
 * Releases escrow funds into the vendor's available balance upon client confirmation
 * or automatic confirmation deadline expiration.
 */
export async function releaseEscrowFunds(
  prisma: any,
  params: {
    vendorId: string;
    orderId: string;
    amount: number;
    reference: string;
    description?: string;
  }
) {
  attachWalletDelegates(prisma);
  const wallet = await getOrCreateVendorWallet(params.vendorId, prisma);
  const currentEscrow = Number(wallet.escrowBalance || 0);
  const currentAvailable = Number(wallet.availableBalance || 0);

  // Invariant check: escrow balance cannot be negative
  const newEscrow = Math.max(0, currentEscrow - params.amount);
  const newAvailable = currentAvailable + params.amount;

  const updatedWallet = await prisma.vendorWallet.update({
    where: { id: wallet.id },
    data: {
      escrowBalance: newEscrow,
      availableBalance: newAvailable,
      updatedAt: new Date(),
    },
  });

  const tx = await prisma.walletTransaction.create({
    data: {
      id: newId('wtx'),
      walletId: wallet.id,
      vendorId: params.vendorId,
      orderId: params.orderId,
      transactionType: 'ESCROW_RELEASED',
      amount: params.amount,
      fee: 0,
      netAmount: params.amount,
      currency: wallet.currency || CURRENCY,
      status: 'COMPLETED',
      balanceBefore: currentAvailable,
      balanceAfter: newAvailable,
      reference: params.reference,
      description: params.description ?? `Escrow funds released to available balance for Order #${params.orderId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return { wallet: updatedWallet, transaction: tx };
}

/**
 * Deducts escrow funds for a customer refund (e.g. order cancelled before delivery,
 * or dispute resolved in favor of client).
 */
export async function refundEscrowFunds(
  prisma: any,
  params: {
    vendorId: string;
    orderId: string;
    disputeId?: string;
    amount: number;
    reference: string;
    description?: string;
    reason?: string;
  }
) {
  attachWalletDelegates(prisma);
  const wallet = await getOrCreateVendorWallet(params.vendorId, prisma);
  const currentEscrow = Number(wallet.escrowBalance || 0);
  const newEscrow = Math.max(0, currentEscrow - params.amount);

  const updatedWallet = await prisma.vendorWallet.update({
    where: { id: wallet.id },
    data: {
      escrowBalance: newEscrow,
      updatedAt: new Date(),
    },
  });

  const tx = await prisma.walletTransaction.create({
    data: {
      id: newId('wtx'),
      walletId: wallet.id,
      vendorId: params.vendorId,
      orderId: params.orderId,
      disputeId: params.disputeId ?? null,
      transactionType: 'REFUND',
      amount: -params.amount,
      fee: 0,
      netAmount: -params.amount,
      currency: wallet.currency || CURRENCY,
      status: 'COMPLETED',
      balanceBefore: currentEscrow,
      balanceAfter: newEscrow,
      reference: params.reference,
      description: params.description ?? `Escrow refund issued for Order #${params.orderId}: ${params.reason ?? 'Refund processed'}`,
      metadata: { reason: params.reason },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return { wallet: updatedWallet, transaction: tx };
}

/**
 * Freezes escrow funds under a dispute hold.
 */
export async function holdDisputeFunds(
  prisma: any,
  params: {
    vendorId: string;
    orderId: string;
    disputeId: string;
    amount: number;
    reference: string;
    reason?: string;
  }
) {
  attachWalletDelegates(prisma);
  const wallet = await getOrCreateVendorWallet(params.vendorId, prisma);

  const tx = await prisma.walletTransaction.create({
    data: {
      id: newId('wtx'),
      walletId: wallet.id,
      vendorId: params.vendorId,
      orderId: params.orderId,
      disputeId: params.disputeId,
      transactionType: 'DISPUTE_HOLD',
      amount: params.amount,
      fee: 0,
      netAmount: params.amount,
      currency: wallet.currency || CURRENCY,
      status: 'HELD',
      balanceBefore: wallet.escrowBalance,
      balanceAfter: wallet.escrowBalance,
      reference: params.reference,
      description: `Dispute opened on Order #${params.orderId}. Escrow release held pending investigation.`,
      metadata: { reason: params.reason },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return { wallet, transaction: tx };
}

/**
 * Request a withdrawal from available balance.
 * Implements strict double-spending protection using atomic Prisma transactions.
 */
export async function requestWithdrawal(params: {
  vendorId: string;
  amount: number;
  method: string;
  destinationType: string;
  destinationReference: string;
  accountName?: string;
  accountDetails?: Record<string, any>;
  idempotencyKey?: string;
}) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  // Validate amount limits
  if (params.amount < MIN_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT.toLocaleString()} ${CURRENCY}`);
  }
  if (params.amount > MAX_WITHDRAWAL_AMOUNT) {
    throw new Error(`Maximum single withdrawal amount is ${MAX_WITHDRAWAL_AMOUNT.toLocaleString()} ${CURRENCY}`);
  }

  // Idempotency check: prevent duplicate submissions
  if (params.idempotencyKey) {
    const existing = await prisma.withdrawal.findFirst({
      where: {
        vendorId: params.vendorId,
        idempotencyKey: params.idempotencyKey,
      },
    });
    if (existing) {
      return { withdrawal: existing, isDuplicate: true };
    }
  }

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    // Atomically fetch and lock the wallet
    const wallet = await getOrCreateVendorWallet(params.vendorId, tx);
    const available = Number(wallet.availableBalance || 0);

    if (available < params.amount) {
      throw new Error(`Insufficient available balance. You have ${available.toLocaleString()} ${CURRENCY} available.`);
    }

    const newAvailable = available - params.amount;
    const newPending = Number(wallet.pendingWithdrawalBalance || 0) + params.amount;

    await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: newAvailable,
        pendingWithdrawalBalance: newPending,
        updatedAt: new Date(),
      },
    });

    const withdrawalId = newId('wth');
    const withdrawal = await tx.withdrawal.create({
      data: {
        id: withdrawalId,
        vendorId: params.vendorId,
        walletId: wallet.id,
        amount: params.amount,
        currency: wallet.currency || CURRENCY,
        method: params.method,
        destinationType: params.destinationType,
        destinationReference: params.destinationReference,
        status: 'PENDING',
        account: {
          destinationType: params.destinationType,
          destinationReference: params.destinationReference,
          accountName: params.accountName ?? '',
          ...(params.accountDetails ?? {}),
        },
        idempotencyKey: params.idempotencyKey ?? null,
        requestedAt: new Date(),
      },
    });

    await tx.walletTransaction.create({
      data: {
        id: newId('wtx'),
        walletId: wallet.id,
        vendorId: params.vendorId,
        withdrawalId,
        transactionType: 'WITHDRAWAL_REQUESTED',
        amount: -params.amount,
        fee: 0,
        netAmount: -params.amount,
        currency: wallet.currency || CURRENCY,
        status: 'PENDING',
        balanceBefore: available,
        balanceAfter: newAvailable,
        reference: withdrawalId,
        description: `Withdrawal of ${params.amount.toLocaleString()} ${CURRENCY} requested to ${params.destinationType} (${params.destinationReference})`,
        metadata: { destinationType: params.destinationType, destinationReference: params.destinationReference },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { withdrawal, isDuplicate: false };
  });
}

/**
 * Marks a withdrawal as completed by payment processor or admin.
 */
export async function completeWithdrawal(withdrawalId: string, providerReference?: string) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status === 'COMPLETED') return withdrawal;
    if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'PROCESSING') {
      throw new Error(`Cannot complete withdrawal in status ${withdrawal.status}`);
    }

    const wallet = await getOrCreateVendorWallet(withdrawal.vendorId, tx);
    const pending = Number(wallet.pendingWithdrawalBalance || 0);
    const withdrawn = Number(wallet.withdrawnAmount || 0);

    const newPending = Math.max(0, pending - withdrawal.amount);
    const newWithdrawn = withdrawn + withdrawal.amount;

    await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: {
        pendingWithdrawalBalance: newPending,
        withdrawnAmount: newWithdrawn,
        updatedAt: new Date(),
      },
    });

    const updatedWithdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'COMPLETED',
        providerReference: providerReference ?? null,
        completedAt: new Date(),
        processedAt: new Date(),
      },
    });

    await tx.walletTransaction.create({
      data: {
        id: newId('wtx'),
        walletId: wallet.id,
        vendorId: withdrawal.vendorId,
        withdrawalId,
        transactionType: 'WITHDRAWAL_COMPLETED',
        amount: withdrawal.amount,
        fee: 0,
        netAmount: withdrawal.amount,
        currency: withdrawal.currency || CURRENCY,
        status: 'COMPLETED',
        reference: providerReference ?? withdrawalId,
        description: `Withdrawal #${withdrawalId} completed successfully. Transfer sent to ${withdrawal.destinationType}.`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updatedWithdrawal;
  });
}

/**
 * Marks a withdrawal as failed and atomically returns funds to the vendor's available balance.
 */
export async function failWithdrawal(withdrawalId: string, reason: string) {
  const prisma = await getPrisma();
  attachWalletDelegates(prisma);

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status === 'FAILED') return withdrawal;
    if (withdrawal.status === 'COMPLETED') throw new Error('Cannot fail an already completed withdrawal');

    const wallet = await getOrCreateVendorWallet(withdrawal.vendorId, tx);
    const pending = Number(wallet.pendingWithdrawalBalance || 0);
    const available = Number(wallet.availableBalance || 0);

    const newPending = Math.max(0, pending - withdrawal.amount);
    const newAvailable = available + withdrawal.amount;

    await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: {
        pendingWithdrawalBalance: newPending,
        availableBalance: newAvailable,
        updatedAt: new Date(),
      },
    });

    const updatedWithdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'FAILED',
        failureReason: reason,
        processedAt: new Date(),
      },
    });

    await tx.walletTransaction.create({
      data: {
        id: newId('wtx'),
        walletId: wallet.id,
        vendorId: withdrawal.vendorId,
        withdrawalId,
        transactionType: 'WITHDRAWAL_FAILED',
        amount: withdrawal.amount,
        fee: 0,
        netAmount: withdrawal.amount,
        currency: withdrawal.currency || CURRENCY,
        status: 'COMPLETED',
        balanceBefore: available,
        balanceAfter: newAvailable,
        reference: withdrawalId,
        description: `Withdrawal #${withdrawalId} failed: ${reason}. Funds returned to available balance.`,
        metadata: { failureReason: reason },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updatedWithdrawal;
  });
}

/**
 * Deposits funds into the vendor's Available Balance.
 * Supports Mobile Money (MTN MoMo, Orange Money), Card, and Bank Wire.
 * Creates an immutable double-entry ledger transaction.
 */
export async function depositToVendorWallet(params: {
  vendorId: string;
  amount: number;
  method?: string;
  phone?: string;
  destinationReference?: string;
  accountName?: string;
  paymentReference?: string;
  notes?: string;
  idempotencyKey?: string;
}): Promise<any> {
  const {
    vendorId,
    amount,
    method = 'MTN_MOMO',
    phone,
    destinationReference,
    accountName,
    paymentReference,
    notes,
    idempotencyKey,
  } = params;

  if (!vendorId) {
    throw new Error('Vendor ID is required for wallet deposit.');
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount < MIN_DEPOSIT_AMOUNT) {
    throw new Error(`Deposit amount must be at least ${MIN_DEPOSIT_AMOUNT.toLocaleString()} ${CURRENCY}.`);
  }

  if (amount > MAX_DEPOSIT_AMOUNT) {
    throw new Error(`Single deposit amount cannot exceed ${MAX_DEPOSIT_AMOUNT.toLocaleString()} ${CURRENCY}.`);
  }

  const prisma = await getPrisma();
  attachWalletDelegates(prisma);
  const now = new Date();
  const depositRef = paymentReference || `DEP_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const refPhone = phone || destinationReference || '';
  const channelLabel = method.replace(/_/g, ' ');

  // Idempotency check if key provided
  if (idempotencyKey) {
    const existing = await prisma.walletTransaction.findFirst({
      where: {
        vendorId,
        idempotencyKey,
      },
    });
    if (existing) {
      const wallet = await getOrCreateVendorWallet(vendorId, prisma);
      return {
        success: true,
        isDuplicate: true,
        transaction: existing,
        wallet,
        message: 'Duplicate deposit detected; previous deposit returned.',
      };
    }
  }

  return prisma.$transaction(async (tx: any) => {
    attachWalletDelegates(tx);

    const wallet = await getOrCreateVendorWallet(vendorId, tx);
    const curAvail = Number(wallet.availableBalance || 0);
    const newAvail = curAvail + amount;

    // 1. Atomically increment availableBalance
    const updatedWallet = await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: newAvail,
        updatedAt: now,
      },
    });

    // 2. Record ledger transaction
    const txId = newId('wtx_dep');
    const transaction = await tx.walletTransaction.create({
      data: {
        id: txId,
        walletId: wallet.id,
        vendorId,
        idempotencyKey: idempotencyKey ?? null,
        transactionType: 'DEPOSIT',
        amount,
        fee: 0,
        netAmount: amount,
        currency: wallet.currency || CURRENCY,
        status: 'COMPLETED',
        balanceBefore: curAvail,
        balanceAfter: newAvail,
        reference: depositRef,
        description: notes || `Deposit of ${amount.toLocaleString()} ${CURRENCY} via ${channelLabel}${refPhone ? ` (${refPhone})` : ''}`,
        metadata: {
          method,
          phone: refPhone,
          accountName: accountName || '',
          depositRef,
          notes: notes || '',
        },
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      success: true,
      amount,
      currency: wallet.currency || CURRENCY,
      balanceBefore: curAvail,
      balanceAfter: newAvail,
      transaction,
      wallet: updatedWallet,
      message: `Successfully deposited ${amount.toLocaleString()} ${CURRENCY} into your wallet.`,
    };
  });
}

