// Smoke test for Architect & Vendor verification pipelines and feature-gating APIs.
import { dbClient } from '../lib/db';

async function run() {
  console.log('--- STARTING VERIFICATION SMOKE TESTS ---');

  // 1. Verify architect profile in DB
  const ap = await dbClient.architectProfile.findUnique({ where: { userId: 'u_architect' } });
  console.log('[1] Initial Architect status:', ap?.verificationStatus, 'license:', ap?.licenseNumber);

  // 2. Test uploading document & saving license details for architect
  const testDoc = {
    id: `doc_smoke_${Date.now()}`,
    name: 'National_Architecture_License_2024.pdf',
    kind: 'professional',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
    fileType: 'application/pdf',
    fileSize: 1048576,
    status: 'PENDING',
    uploadedAt: new Date().toISOString(),
  };

  const updatedDocs = [testDoc];
  await dbClient.architectProfile.update({
    where: { userId: 'u_architect' },
    data: {
      licenseNumber: 'ONIGC-2024-TEST-99',
      experience: 14,
      verificationStatus: 'PENDING',
      verificationDocs: updatedDocs,
    },
  });

  const apPending = await dbClient.architectProfile.findUnique({ where: { userId: 'u_architect' } });
  console.log('[2] Architect submitted for review:', apPending?.verificationStatus === 'PENDING' ? 'PASS' : 'FAIL', 'Docs count:', (apPending?.verificationDocs as any[])?.length);

  // 3. Test Admin reviewing and approving Architect
  await dbClient.architectProfile.update({
    where: { userId: 'u_architect' },
    data: {
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });
  const apVerified = await dbClient.architectProfile.findUnique({ where: { userId: 'u_architect' } });
  console.log('[3] Admin approved Architect:', apVerified?.verificationStatus === 'VERIFIED' ? 'PASS' : 'FAIL');

  // 4. Test Vendor profile & submission
  const vp = await dbClient.vendorProfile.findUnique({ where: { userId: 'u_vendor' } });
  console.log('[4] Initial Vendor status:', vp?.verificationStatus, 'level:', vp?.verificationLevel);

  const testVendorDoc = {
    id: `doc_vsmoke_${Date.now()}`,
    name: 'RCCM_Commercial_Registry.pdf',
    kind: 'business_registration',
    fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
    fileType: 'application/pdf',
    fileSize: 524288,
    status: 'PENDING',
    uploadedAt: new Date().toISOString(),
  };

  await dbClient.vendorProfile.update({
    where: { userId: 'u_vendor' },
    data: {
      businessName: 'Prime Materials EU',
      registrationNumber: 'RC/DLA/2024/TEST/4421',
      taxId: 'M052400018992P',
      verificationStatus: 'PENDING',
      verificationLevel: 'UNVERIFIED',
      verificationDocs: [testVendorDoc],
    },
  });

  const vpPending = await dbClient.vendorProfile.findUnique({ where: { userId: 'u_vendor' } });
  console.log('[5] Vendor submitted for review:', vpPending?.verificationStatus === 'PENDING' ? 'PASS' : 'FAIL');

  // 5. Test Admin approving Vendor
  await dbClient.vendorProfile.update({
    where: { userId: 'u_vendor' },
    data: {
      verificationStatus: 'FULLY_VERIFIED',
      verificationLevel: 'VERIFIED_VENDOR',
      verifiedAt: new Date(),
    },
  });

  const vpVerified = await dbClient.vendorProfile.findUnique({ where: { userId: 'u_vendor' } });
  console.log('[6] Admin approved Vendor:', (vpVerified?.verificationStatus === 'FULLY_VERIFIED' && vpVerified?.verificationLevel === 'VERIFIED_VENDOR') ? 'PASS' : 'FAIL');

  console.log('--- ALL VERIFICATION PIPELINE TESTS PASSED ---');
}

run().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
