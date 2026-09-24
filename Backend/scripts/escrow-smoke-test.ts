// BuildSmart AI — Automated Escrow & Vendor Wallet System Smoke Test
// Comprehensive test suite covering:
// 1. Vendor wallet initialization & ledger invariants
// 2. Order checkout & atomic escrow locking
// 3. Vendor delivery marking & 72h inspection window activation
// 4. Client delivery confirmation & atomic fund release
// 5. Idempotent guard against double-release
// 6. Client dispute opening, vendor response, and admin mediation (split resolution)
// 7. Vendor withdrawal, double-spending prevention, idempotency, and failure recovery
// 8. Automated auto-release engine for expired inspection windows
// 9. Platform-wide escrow metrics

import { dbClient, getPrisma } from '../lib/db.ts';
import { ensureDatabaseSchema } from '../lib/pg-setup.ts';
import {
  getOrCreateVendorWallet,
  getWalletSummary,
  getWalletTransactions,
  requestWithdrawal,
  completeWithdrawal,
  failWithdrawal,
} from '../lib/wallet.ts';
import {
  initiateOrderEscrow,
  markOrderDelivered,
  confirmDelivery,
  openDispute,
  respondToDispute,
  resolveDispute,
  processExpiredEscrows,
  getPlatformEscrowSummary,
} from '../lib/escrow.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runEscrowSmokeSuite() {
  console.log('================================================================');
  console.log('🚀 BUILDSMART ESCROW & VENDOR WALLET SYSTEM SMOKE SUITE');
  console.log('================================================================\n');

  // Step 0: Ensure DB tables exist
  console.log('📦 Step 0: Ensuring database tables and schema migrations...');
  await ensureDatabaseSchema();
  console.log('  ✅ Database schema verified.\n');

  const testVendorId = `test_vendor_${Date.now()}`;
  const testClientId = `test_client_${Date.now()}`;

  // Ensure test users exist in DB
  const existingVendor = await dbClient.user.findUnique({ where: { id: testVendorId } });
  if (!existingVendor) {
    await dbClient.user.create({
      data: {
        id: testVendorId,
        email: `${testVendorId}@example.com`,
        name: 'Smoke Test Vendor',
        role: 'VENDOR',
      },
    });
  }

  const existingClient = await dbClient.user.findUnique({ where: { id: testClientId } });
  if (!existingClient) {
    await dbClient.user.create({
      data: {
        id: testClientId,
        email: `${testClientId}@example.com`,
        name: 'Smoke Test Client',
        role: 'CLIENT',
      },
    });
  }

  // Ensure vendor profile exists
  const existingVP = await dbClient.vendorProfile.findUnique({ where: { userId: testVendorId } });
  if (!existingVP) {
    await dbClient.vendorProfile.create({
      data: {
        userId: testVendorId,
        businessName: 'Smoke Test Construction Supplies',
        verificationStatus: 'VERIFIED',
      },
    });
  }

  // Create product owned by testVendorId
  const testProd1 = await dbClient.product.create({
    data: {
      vendorId: testVendorId,
      name: 'High-Grade Portland Cement 50kg',
      price: 10000,
      unit: 'bag',
      category: 'Building Materials',
      stock: 500,
    },
  });

  // ============================================================================
  // TEST 1: Vendor Wallet Initialization & Invariants
  // ============================================================================
  console.log('🔍 Test 1: Vendor Wallet Initialization & Ledger Invariants...');
  const wallet = await getOrCreateVendorWallet(testVendorId);
  assert(!!wallet.id, 'Wallet created with a valid ID');
  assert(wallet.vendorId === testVendorId, 'Wallet assigned to correct vendor');
  assert(wallet.availableBalance === 0, 'Initial available balance is 0');
  assert(wallet.escrowBalance === 0, 'Initial escrow balance is 0');
  assert(wallet.pendingWithdrawalBalance === 0, 'Initial pending withdrawal is 0');

  const summary = await getWalletSummary(testVendorId);
  assert(summary.totalBalance === 0, 'Total balance matches sum of parts (0)');
  console.log('  Initial wallet state verified.\n');

  // ============================================================================
  // TEST 2: Order Checkout & Escrow Locking
  // ============================================================================
  console.log('🔍 Test 2: Order Checkout & Atomic Escrow Locking...');
  const testOrder1 = await dbClient.order.create({
    data: {
      userId: testClientId,
      status: 'PROCESSING',
      escrowStatus: 'ESCROWED',
      totalAmount: 100000, // 100,000 XAF
      currency: 'XAF',
    },
  });

  await dbClient.orderItem.create({
    data: {
      orderId: testOrder1.id,
      productId: testProd1.id,
      quantity: 10,
      unitPrice: 10000,
      total: 100000,
    },
  });

  const createdEscrows = await initiateOrderEscrow({
    orderId: testOrder1.id,
    clientId: testClientId,
    commissionRate: 0.10, // 10% commission
  });

  assert(Array.isArray(createdEscrows) && createdEscrows.length === 1, '1 escrow transaction created for vendor');
  const escrow1 = createdEscrows[0];
  assert(escrow1.grossAmount === 100000, 'Gross amount is 100,000 XAF');
  assert(escrow1.platformFee === 10000, 'Platform commission is 10,000 XAF (10%)');
  assert(escrow1.amount === 90000, 'Vendor net amount is 90,000 XAF');
  assert(escrow1.status === 'ESCROWED', 'Escrow status is ESCROWED');

  // Check vendor wallet after lock
  const postLockWallet = await getWalletSummary(testVendorId);
  assert(postLockWallet.escrowBalance === 90000, 'Vendor escrow balance incremented to 90,000 XAF');
  assert(postLockWallet.availableBalance === 0, 'Vendor available balance remains 0 (funds are locked)');
  assert(postLockWallet.totalBalance === 90000, 'Total balance reflects 90,000 XAF');

  // Verify ledger entry
  const lockLedger = await getWalletTransactions(testVendorId);
  assert(lockLedger.transactions.length >= 1, 'At least 1 ledger transaction recorded');
  const lockedTx = lockLedger.transactions.find((t) => t.transactionType === 'ESCROW_LOCKED');
  assert(!!lockedTx, 'Ledger contains ESCROW_LOCKED record');
  assert(lockedTx?.amount === 90000, 'Ledger locked amount matches vendor net 90,000 XAF\n');

  // ============================================================================
  // TEST 3: Vendor Delivery Marking & Inspection Window Activation
  // ============================================================================
  console.log('🔍 Test 3: Vendor Delivery Marking & 72h Countdown Window...');
  const deliveryResult = await markOrderDelivered({
    orderId: testOrder1.id,
    vendorId: testVendorId,
  });

  assert(
    deliveryResult.escrow.status === 'CLIENT_CONFIRMATION_PENDING',
    'Escrow status transitioned to CLIENT_CONFIRMATION_PENDING',
  );
  assert(!!deliveryResult.deadline, 'Confirmation deadline was calculated');

  const deadlineDate = new Date(deliveryResult.deadline);
  const diffHours = (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60);
  assert(diffHours > 70 && diffHours <= 73, `Deadline set to ~72 hours in future (${diffHours.toFixed(1)}h)\n`);

  // ============================================================================
  // TEST 4: Client Delivery Confirmation & Atomic Fund Release
  // ============================================================================
  console.log('🔍 Test 4: Client Delivery Confirmation & Atomic Fund Release...');
  const confirmResult = await confirmDelivery({
    orderId: testOrder1.id,
    clientId: testClientId,
  });

  assert(!confirmResult.alreadyReleased, 'First confirmation executed release');
  assert(confirmResult.escrow.status === 'RELEASED', 'Escrow status transitioned to RELEASED');

  const postReleaseWallet = await getWalletSummary(testVendorId);
  assert(postReleaseWallet.escrowBalance === 0, 'Escrow balance decremented to 0');
  assert(postReleaseWallet.availableBalance === 90000, 'Available balance credited with 90,000 XAF');
  assert(postReleaseWallet.totalBalance === 90000, 'Total balance remains 90,000 XAF');

  const releaseLedger = await getWalletTransactions(testVendorId);
  const releasedTx = releaseLedger.transactions.find((t) => t.transactionType === 'ESCROW_RELEASED');
  assert(!!releasedTx, 'Ledger contains ESCROW_RELEASED record');
  assert(releasedTx?.amount === 90000, 'Ledger release amount matches 90,000 XAF\n');

  // ============================================================================
  // TEST 5: Idempotency & Re-confirmation Guard
  // ============================================================================
  console.log('🔍 Test 5: Re-confirmation Guard (Double-Release Prevention)...');
  const doubleConfirm = await confirmDelivery({
    orderId: testOrder1.id,
    clientId: testClientId,
  });
  assert(doubleConfirm.alreadyReleased === true, 'Double-confirmation handled idempotently (alreadyReleased=true)');
  const checkWalletAgain = await getWalletSummary(testVendorId);
  assert(checkWalletAgain.availableBalance === 90000, 'Available balance was NOT credited twice\n');

  // ============================================================================
  // TEST 6: Dispute Workflow (Open, Respond, Admin Split Resolution)
  // ============================================================================
  console.log('🔍 Test 6: Dispute Workflow & Split Resolution...');
  const testProd2 = await dbClient.product.create({
    data: {
      vendorId: testVendorId,
      name: 'Steel Reinforcement Rebar 12mm',
      price: 50000,
      unit: 'bundle',
      category: 'Building Materials',
      stock: 100,
    },
  });

  const testOrder2 = await dbClient.order.create({
    data: {
      userId: testClientId,
      status: 'PROCESSING',
      escrowStatus: 'ESCROWED',
      totalAmount: 50000, // 50,000 XAF
      currency: 'XAF',
    },
  });

  await dbClient.orderItem.create({
    data: {
      orderId: testOrder2.id,
      productId: testProd2.id,
      quantity: 1,
      unitPrice: 50000,
      total: 50000,
    },
  });

  await initiateOrderEscrow({
    orderId: testOrder2.id,
    clientId: testClientId,
    commissionRate: 0.10, // 5,000 commission, 45,000 net
  });

  await markOrderDelivered({
    orderId: testOrder2.id,
    vendorId: testVendorId,
  });

  // Client opens dispute
  const disputeResult = await openDispute({
    orderId: testOrder2.id,
    clientId: testClientId,
    reason: 'DAMAGED_GOODS',
    description: 'Rebars bent and severely damaged during transit',
  });

  assert(disputeResult.escrow.status === 'DISPUTED', 'Escrow status frozen in DISPUTED');
  assert(!!disputeResult.dispute?.id, 'Dispute case ID created');

  // Vendor responds with evidence
  const vendorResponse = await respondToDispute({
    disputeId: disputeResult.dispute.id,
    vendorId: testVendorId,
    response: 'We reviewed delivery photos; agreeing to partial refund of 15,000 XAF.',
  });
  assert(!!vendorResponse.id, 'Vendor responded to dispute successfully');

  // Admin resolves dispute with partial split: 15,000 XAF refund to client, 30,000 XAF released to vendor
  const adminResolution = await resolveDispute({
    disputeId: disputeResult.dispute.id,
    adminId: 'u_admin',
    adminName: 'BuildSmart Admin',
    resolutionType: 'PARTIAL',
    resolutionNote: 'Agreed on 15k refund for damaged rebar and 30k vendor payout.',
    clientRefundAmount: 15000,
    vendorReleaseAmount: 30000,
  });

  assert(adminResolution.success, 'Admin resolved dispute with partial split');

  const postDisputeWallet = await getWalletSummary(testVendorId);
  // Previous available was 90,000. Now + 30,000 = 120,000. Escrow should be back to 0.
  assert(postDisputeWallet.availableBalance === 120000, `Vendor available balance is 120,000 XAF (got ${postDisputeWallet.availableBalance})`);
  assert(postDisputeWallet.escrowBalance === 0, 'Vendor escrow balance is 0');
  console.log('  Dispute successfully settled and ledger balances updated.\n');

  // ============================================================================
  // TEST 7: Withdrawal & Double-Spending Prevention
  // ============================================================================
  console.log('🔍 Test 7: Vendor Withdrawal, Double-Spending & Idempotency...');

  // 7a. Reject withdrawal below minimum (1,000 XAF)
  let rejectedMin = false;
  try {
    await requestWithdrawal({
      vendorId: testVendorId,
      amount: 500,
      method: 'MTN_MOMO',
      destinationType: 'MTN_MOMO',
      destinationReference: '+237670112233',
    });
  } catch (err: any) {
    rejectedMin = true;
  }
  assert(rejectedMin, 'Withdrawal below minimum rejected with Error');

  // 7b. Reject withdrawal exceeding available balance (current available: 120,000)
  let rejectedOverdraft = false;
  try {
    await requestWithdrawal({
      vendorId: testVendorId,
      amount: 200000,
      method: 'MTN_MOMO',
      destinationType: 'MTN_MOMO',
      destinationReference: '+237670112233',
    });
  } catch (err: any) {
    rejectedOverdraft = true;
  }
  assert(rejectedOverdraft, 'Overdraft withdrawal rejected with Error');

  // 7c. Valid withdrawal of 50,000 XAF
  const idempotencyKey = `idemp_${Date.now()}`;
  const validWithdrawal = await requestWithdrawal({
    vendorId: testVendorId,
    amount: 50000,
    method: 'MTN_MOMO',
    destinationType: 'MTN_MOMO',
    destinationReference: '+237670112233',
    idempotencyKey,
  });
  assert(validWithdrawal.withdrawal.status === 'PENDING', 'Withdrawal is PENDING');

  // Check balances during pending withdrawal
  const pendingWallet = await getWalletSummary(testVendorId);
  assert(pendingWallet.availableBalance === 70000, 'Available balance reduced to 70,000 XAF');
  assert(pendingWallet.pendingWithdrawalBalance === 50000, 'Pending balance set to 50,000 XAF');
  assert(pendingWallet.totalBalance === 120000, 'Total balance preserved at 120,000 XAF');

  // 7d. Idempotency test: duplicate request with same key
  const duplicateWithdrawal = await requestWithdrawal({
    vendorId: testVendorId,
    amount: 50000,
    method: 'MTN_MOMO',
    destinationType: 'MTN_MOMO',
    destinationReference: '+237670112233',
    idempotencyKey,
  });
  assert(duplicateWithdrawal.isDuplicate === true, 'Duplicate call recognized as duplicate');
  assert(duplicateWithdrawal.withdrawal.id === validWithdrawal.withdrawal.id, 'Returned original withdrawal ID');

  const duplicateWallet = await getWalletSummary(testVendorId);
  assert(duplicateWallet.availableBalance === 70000, 'Available balance was NOT deducted twice');

  // 7e. Complete withdrawal
  const completedWithdrawal = await completeWithdrawal(validWithdrawal.withdrawal.id, 'MOMO_TXN_998877');
  assert(completedWithdrawal.status === 'COMPLETED', 'Withdrawal marked COMPLETED');

  const postCompleteWallet = await getWalletSummary(testVendorId);
  assert(postCompleteWallet.availableBalance === 70000, 'Available balance remains 70,000 XAF');
  assert(postCompleteWallet.pendingWithdrawalBalance === 0, 'Pending balance cleared to 0');
  assert(postCompleteWallet.withdrawnAmount === 50000, 'Withdrawn amount incremented to 50,000 XAF');
  assert(postCompleteWallet.totalBalance === 70000, 'Total balance is now 70,000 XAF');

  // 7f. Failure & fund restoration
  const failTestReq = await requestWithdrawal({
    vendorId: testVendorId,
    amount: 20000,
    method: 'ORANGE_MONEY',
    destinationType: 'ORANGE_MONEY',
    destinationReference: '+237699887766',
  });
  assert((await getWalletSummary(testVendorId)).availableBalance === 50000, 'Available temporarily at 50,000 XAF');

  const failedWithdrawal = await failWithdrawal(failTestReq.withdrawal.id, 'Mobile Money phone number not registered');
  assert(failedWithdrawal.status === 'FAILED', 'Withdrawal marked FAILED');

  const postFailWallet = await getWalletSummary(testVendorId);
  assert(postFailWallet.availableBalance === 70000, '20,000 XAF was safely RESTORED to available balance');
  assert(postFailWallet.pendingWithdrawalBalance === 0, 'Pending balance restored to 0\n');

  // ============================================================================
  // TEST 8: Automated Escrow Auto-Release Engine (Expired Inspection Window)
  // ============================================================================
  console.log('🔍 Test 8: Automated Escrow Auto-Release on Expired Inspection Window...');
  const testProd3 = await dbClient.product.create({
    data: {
      vendorId: testVendorId,
      name: 'Granite Aggregates 15/25 (1 Ton)',
      price: 30000,
      unit: 'ton',
      category: 'Building Materials',
      stock: 50,
    },
  });

  const testOrder3 = await dbClient.order.create({
    data: {
      userId: testClientId,
      status: 'PROCESSING',
      escrowStatus: 'ESCROWED',
      totalAmount: 30000, // 30,000 XAF
      currency: 'XAF',
    },
  });

  await dbClient.orderItem.create({
    data: {
      orderId: testOrder3.id,
      productId: testProd3.id,
      quantity: 1,
      unitPrice: 30000,
      total: 30000,
    },
  });

  const escrow3List = await initiateOrderEscrow({
    orderId: testOrder3.id,
    clientId: testClientId,
    commissionRate: 0.10, // 3,000 commission, 27,000 net
  });
  const escrow3 = escrow3List[0];

  await markOrderDelivered({
    orderId: testOrder3.id,
    vendorId: testVendorId,
  });

  // Manually simulate an expired deadline in the past (e.g. 2 hours ago)
  const pastDeadline = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await dbClient.escrowTransaction.update({
    where: { id: escrow3.id },
    data: {
      confirmationDeadline: pastDeadline,
    },
  });

  // Execute auto-release worker
  const autoReleaseReport = await processExpiredEscrows();
  assert(autoReleaseReport.processed >= 1, 'Auto-release worker processed at least 1 expired escrow');
  console.log('  Auto-release report:', autoReleaseReport);

  const updatedEscrow3 = await dbClient.escrowTransaction.findUnique({
    where: { id: escrow3.id },
  });
  assert(updatedEscrow3?.status === 'RELEASED', 'Expired escrow automatically updated to RELEASED');

  const finalWallet = await getWalletSummary(testVendorId);
  // Previous available was 70,000. Now + 27,000 = 97,000 XAF.
  assert(finalWallet.availableBalance === 97000, `Vendor available balance is 97,000 XAF (got ${finalWallet.availableBalance})`);
  assert(finalWallet.escrowBalance === 0, 'Escrow balance is 0\n');

  // ============================================================================
  // TEST 9: Platform-wide Escrow & Financial Summary
  // ============================================================================
  console.log('🔍 Test 9: Platform-wide Escrow Financial Summary...');
  const platformSummary = await getPlatformEscrowSummary();
  assert(platformSummary.totalEscrows >= 3, 'Summary includes all created escrows');
  assert(platformSummary.releasedCount >= 2, 'At least 2 escrows released');
  console.log('  Platform metrics:', platformSummary);

  console.log('\n================================================================');
  console.log('🎉 ALL 9 ESCROW & VENDOR WALLET SUITE TESTS PASSED PERFECTLY!');
  console.log('================================================================\n');
}

runEscrowSmokeSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
    process.exit(1);
  });
