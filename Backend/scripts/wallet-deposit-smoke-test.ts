// BuildSmart AI — Automated Wallet Deposit Smoke Test for Architect and Vendor
// Verifies:
// 1. Architect wallet deposit via MoMo and Card
// 2. Double-entry ledger recording and availableBalance increment
// 3. Vendor wallet deposit via Orange Money and Bank Wire
// 4. Boundary validations (minimum deposit threshold)
// 5. Idempotency protection against duplicate submissions

import { dbClient } from '../lib/db.ts';
import { ensureDatabaseSchema } from '../lib/pg-setup.ts';
import {
  getOrCreateArchitectWallet,
  getArchitectWalletSummary,
  depositToArchitectWallet,
  MIN_DEPOSIT_AMOUNT,
  MAX_DEPOSIT_AMOUNT,
} from '../lib/architect-escrow.ts';
import {
  getOrCreateVendorWallet,
  getWalletSummary,
  depositToVendorWallet,
} from '../lib/wallet.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runDepositSmokeTest() {
  console.log('================================================================');
  console.log('💰 BUILDSMART ARCHITECT & VENDOR WALLET DEPOSIT SMOKE TEST');
  console.log('================================================================\n');

  console.log('📦 Step 0: Ensuring database tables and schema migrations...');
  await ensureDatabaseSchema();
  console.log('  ✅ Database schema verified.\n');

  const timestamp = Date.now();
  const testArchId = `test_arch_dep_${timestamp}`;
  const testVendorId = `test_vendor_dep_${timestamp}`;

  // Ensure test users
  await dbClient.user.create({
    data: {
      id: testArchId,
      email: `${testArchId}@buildsmart.ai`,
      name: 'Architect Deposit Tester',
      role: 'ARCHITECT',
    },
  });

  await dbClient.user.create({
    data: {
      id: testVendorId,
      email: `${testVendorId}@buildsmart.ai`,
      name: 'Vendor Deposit Tester',
      role: 'VENDOR',
    },
  });

  // --------------------------------------------------------------------------
  // TEST 1: Architect Wallet Deposit
  // --------------------------------------------------------------------------
  console.log('📐 Step 1: Testing Architect Wallet Deposit...');
  const initArchWallet = await getOrCreateArchitectWallet(testArchId);
  const initialArchBalance = Number(initArchWallet.availableBalance || 0);
  assert(initialArchBalance === 0, `Initial architect available balance is 0 (got ${initialArchBalance})`);

  // Deposit 25,000 XAF via MTN MoMo
  const archDeposit1 = await depositToArchitectWallet({
    architectId: testArchId,
    amount: 25000,
    method: 'MTN_MOMO',
    phone: '677123456',
    accountName: 'Architect Deposit Tester',
  });

  assert(archDeposit1.success === true, 'Architect deposit 1 succeeded');
  assert(archDeposit1.balanceBefore === 0, 'Balance before was 0');
  assert(archDeposit1.balanceAfter === 25000, 'Balance after is 25,000 XAF');
  assert(archDeposit1.transaction.transactionType === 'DEPOSIT', 'Transaction type is DEPOSIT');
  assert(archDeposit1.transaction.amount === 25000, 'Transaction amount is 25,000');
  assert(archDeposit1.transaction.netAmount === 25000, 'Transaction netAmount is 25,000');

  // Verify wallet summary
  const archSummary1 = await getArchitectWalletSummary(testArchId);
  assert(archSummary1.availableBalance === 25000, `Architect summary reflects 25,000 XAF available (got ${archSummary1.availableBalance})`);

  // Deposit 50,000 XAF via Card
  const archDeposit2 = await depositToArchitectWallet({
    architectId: testArchId,
    amount: 50000,
    method: 'CARD',
    accountName: 'Architect Deposit Tester',
  });

  assert(archDeposit2.success === true, 'Architect deposit 2 succeeded');
  assert(archDeposit2.balanceAfter === 75000, `Architect balance accumulated to 75,000 XAF (got ${archDeposit2.balanceAfter})`);

  const archSummary2 = await getArchitectWalletSummary(testArchId);
  assert(archSummary2.availableBalance === 75000, `Architect summary reflects 75,000 XAF (got ${archSummary2.availableBalance})`);
  console.log('  ✅ Architect deposit suite passed.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Vendor Wallet Deposit
  // --------------------------------------------------------------------------
  console.log('🏬 Step 2: Testing Vendor Wallet Deposit...');
  const initVendorWallet = await getOrCreateVendorWallet(testVendorId);
  const initialVendorBalance = Number(initVendorWallet.availableBalance || 0);
  assert(initialVendorBalance === 0, `Initial vendor available balance is 0 (got ${initialVendorBalance})`);

  // Deposit 30,000 XAF via Orange Money
  const vendorDeposit1 = await depositToVendorWallet({
    vendorId: testVendorId,
    amount: 30000,
    method: 'ORANGE_MONEY',
    phone: '699123456',
    accountName: 'Vendor Deposit Tester',
  });

  assert(vendorDeposit1.success === true, 'Vendor deposit 1 succeeded');
  assert(vendorDeposit1.balanceBefore === 0, 'Balance before was 0');
  assert(vendorDeposit1.balanceAfter === 30000, 'Balance after is 30,000 XAF');
  assert(vendorDeposit1.transaction.transactionType === 'DEPOSIT', 'Transaction type is DEPOSIT');
  assert(vendorDeposit1.transaction.amount === 30000, 'Transaction amount is 30,000');

  // Verify vendor summary
  const vendorSummary1 = await getWalletSummary(testVendorId);
  assert(vendorSummary1.availableBalance === 30000, `Vendor summary reflects 30,000 XAF available (got ${vendorSummary1.availableBalance})`);

  // Deposit 70,000 XAF via Bank Transfer
  const vendorDeposit2 = await depositToVendorWallet({
    vendorId: testVendorId,
    amount: 70000,
    method: 'BANK_TRANSFER',
    accountName: 'Vendor Deposit Tester',
  });

  assert(vendorDeposit2.success === true, 'Vendor deposit 2 succeeded');
  assert(vendorDeposit2.balanceAfter === 100000, `Vendor balance accumulated to 100,000 XAF (got ${vendorDeposit2.balanceAfter})`);

  const vendorSummary2 = await getWalletSummary(testVendorId);
  assert(vendorSummary2.availableBalance === 100000, `Vendor summary reflects 100,000 XAF (got ${vendorSummary2.availableBalance})`);
  console.log('  ✅ Vendor deposit suite passed.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Validation and Idempotency Protection
  // --------------------------------------------------------------------------
  console.log('🛡️ Step 3: Testing Validation & Idempotency...');

  // Minimum deposit threshold check
  let belowMinFailed = false;
  try {
    await depositToArchitectWallet({
      architectId: testArchId,
      amount: 100, // Below 500 minimum
    });
  } catch (err: any) {
    belowMinFailed = true;
    assert(err.message.includes('at least'), `Rejected amount below minimum: "${err.message}"`);
  }
  assert(belowMinFailed, 'Deposit below MIN_DEPOSIT_AMOUNT was properly rejected');

  // Idempotency duplicate check
  const idempotencyKey = `dep_idem_${timestamp}`;
  const firstCall = await depositToVendorWallet({
    vendorId: testVendorId,
    amount: 15000,
    idempotencyKey,
  });
  assert(firstCall.success === true && !firstCall.isDuplicate, 'First call with idempotencyKey succeeded');

  const duplicateCall = await depositToVendorWallet({
    vendorId: testVendorId,
    amount: 15000,
    idempotencyKey,
  });
  assert(duplicateCall.isDuplicate === true, 'Duplicate call detected and prevented double-crediting');

  const vendorSummaryFinal = await getWalletSummary(testVendorId);
  assert(vendorSummaryFinal.availableBalance === 115000, `Balance remained 115,000 without duplicate credit (got ${vendorSummaryFinal.availableBalance})`);
  console.log('  ✅ Validation & idempotency suite passed.\n');

  console.log('================================================================');
  console.log('🎉 ALL ARCHITECT & VENDOR WALLET DEPOSIT TESTS PASSED!');
  console.log('================================================================\n');
}

runDepositSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Smoke test suite encountered fatal error:', err);
    process.exit(1);
  });
