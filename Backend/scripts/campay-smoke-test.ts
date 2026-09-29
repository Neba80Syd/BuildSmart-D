// BuildSmart AI — Campay Payment Gateway Comprehensive Smoke Test
import 'dotenv/config';
import { campayClient } from '../services/campay/index.ts';
import { getPaymentProvider } from '../lib/payment-provider.ts';

async function runCampaySmokeTest() {
  console.log('\n========================================');
  console.log('  BUILDSMART AI — CAMPAY SMOKE TEST');
  console.log('========================================\n');

  const config = campayClient.getConfig();
  console.log('1. Configuration:');
  console.log('   - Base URL:', config.baseUrl);
  console.log('   - Token configured:', Boolean(config.token), config.token ? `(${config.token.slice(0, 8)}...)` : '');
  console.log('   - Demo mode:', config.isDemo);
  console.log('   - Max demo amount:', config.maxDemoAmount, 'XAF\n');

  // Test 2: Balance Check
  console.log('2. Checking Account Balance:');
  try {
    const balance = await campayClient.getBalance();
    console.log('   [SUCCESS] Account Balance retrieved successfully:');
    console.log('   - Total Balance:', balance.total_balance, balance.currency);
    console.log('   - MTN Balance:', balance.mtn_balance);
    console.log('   - Orange Balance:', balance.orange_balance);
  } catch (err: any) {
    console.warn('   [WARN] Could not retrieve balance:', err.message);
  }

  // Test 3: Phone Number Normalization & Operator Detection
  console.log('\n3. Testing Phone Normalization & Operator Detection:');
  const testPhones = [
    { input: '677123456', expectedOp: 'MTN' },
    { input: '+237 699 88 77 66', expectedOp: 'ORANGE' },
    { input: '237650123456', expectedOp: 'MTN' },
    { input: '655998877', expectedOp: 'ORANGE' },
  ];

  for (const t of testPhones) {
    const norm = campayClient.normalizePhoneNumber(t.input);
    const op = campayClient.detectOperator(norm);
    console.log(`   - Input: "${t.input}" -> Normalized: "${norm}" -> Operator: ${op} (matches expected: ${op === t.expectedOp})`);
  }

  // Test 4: Hosted Payment Link Generation
  console.log('\n4. Testing Payment Link Generation:');
  const testRef = `test_bs_${Date.now()}`;
  try {
    const linkRes = await campayClient.getPaymentLink({
      amount: 15,
      description: 'BuildSmart Escrow Test Payment',
      externalReference: testRef,
    });
    console.log('   [SUCCESS] Hosted payment link generated successfully:');
    console.log('   - Reference UUID:', linkRes.reference);
    console.log('   - Payment Link:', linkRes.link);

    // Test 5: Verify Payment via Provider
    console.log('\n5. Testing Transaction Verification via Provider:');
    const campayProv = getPaymentProvider('CAMPAY');
    const verifyRes = await campayProv.verifyPayment(linkRes.reference);
    console.log('   [SUCCESS] Transaction verify response:');
    console.log('   - Verified:', verifyRes.verified);
    console.log('   - Status:', verifyRes.status);
    console.log('   - Reference:', verifyRes.reference);
  } catch (err: any) {
    console.error('   [FAIL] Payment link test failed:', err.message);
  }

  // Test 6: Payment Provider Routing Check
  console.log('\n6. Testing Payment Provider Adapter Integration:');
  const campayProv = getPaymentProvider('CAMPAY');
  const mtnProv = getPaymentProvider('MTN_MOMO');
  const omProv = getPaymentProvider('ORANGE_MONEY');

  console.log('   - CAMPAY provider resolved:', campayProv.constructor.name);
  console.log('   - MTN_MOMO routed via Campay:', mtnProv.constructor.name === 'CampayPaymentProvider');
  console.log('   - ORANGE_MONEY routed via Campay:', omProv.constructor.name === 'CampayPaymentProvider');

  // Test 7: Direct Collect Initialization via Provider
  console.log('\n7. Testing Provider initializePayment (MTN Direct Push):');
  try {
    const initRes = await campayProv.initializePayment({
      amount: 20,
      paymentMethod: 'MTN_MOMO',
      reference: `ord_test_${Date.now()}`,
      description: 'Test Order Payment',
      clientPhone: '670000000',
    });
    console.log('   [SUCCESS] Payment initialization response:');
    console.log('   - Status:', initRes.status);
    console.log('   - Provider Reference:', initRes.providerReference);
    console.log('   - USSD Code:', initRes.ussdCode);
    console.log('   - Instructions:', initRes.instructions);

    // Test 8: Query transaction status of the collect reference
    console.log('\n8. Testing Transaction Status Query on Collect Reference:');
    if (initRes.providerReference) {
      const txStatus = await campayClient.getTransactionStatus(initRes.providerReference);
      console.log('   [SUCCESS] Transaction Status queried successfully:');
      console.log('   - Status:', txStatus.status);
      console.log('   - Amount:', txStatus.amount, txStatus.currency);
      console.log('   - Operator:', txStatus.operator);
      console.log('   - Reference:', txStatus.reference);
    }
  } catch (err: any) {
    console.log('   [INFO] Direct collect test result:', err.message);
  }

  console.log('\n========================================');
  console.log('  CAMPAY SMOKE TEST COMPLETED');
  console.log('========================================\n');
}

runCampaySmokeTest().catch((err) => {
  console.error('Unhandled smoke test error:', err);
  process.exit(1);
});
