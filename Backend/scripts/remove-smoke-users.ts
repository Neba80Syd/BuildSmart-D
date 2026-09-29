/**
 * Script to safely remove all smoke test and synthetic testing users from BuildSmart.
 *
 * Preserves all genuine users and demo accounts:
 * - jordan@buildsmart.ai (u_client)
 * - elena@buildsmart.ai (u_architect)
 * - marcus@buildsmart.ai (u_vendor)
 * - admin@buildsmart.ai (u_admin)
 * - nebdosydo@gmail.com (id_mtx820zap1ixe8m)
 * - miguel@gmail.com (id_mtz29z1ij1gtzu3)
 * - nebdovendor@gmail.com (id_mu14msmh82u4gly)
 */

import { getPgPool } from '../lib/pg-setup.ts';

const PROTECTED_EMAILS = new Set([
  'jordan@buildsmart.ai',
  'elena@buildsmart.ai',
  'marcus@buildsmart.ai',
  'admin@buildsmart.ai',
  'nebdosydo@gmail.com',
  'miguel@gmail.com',
  'nebdovendor@gmail.com',
]);

const PROTECTED_IDS = new Set([
  'u_client',
  'u_architect',
  'u_vendor',
  'u_admin',
  'id_mtx820zap1ixe8m',
  'id_mtz29z1ij1gtzu3',
  'id_mu14msmh82u4gly',
]);

function isSmokeTestUser(user: { id: string; email: string; name?: string | null }) {
  if (PROTECTED_EMAILS.has(user.email) || PROTECTED_IDS.has(user.id)) {
    return false;
  }

  const email = (user.email || '').toLowerCase().trim();
  const name = (user.name || '').toLowerCase().trim();
  const id = (user.id || '').toLowerCase().trim();

  if (
    id.startsWith('test_') ||
    email.includes('smoke') ||
    email.includes('@example.com') ||
    email.includes('.test') ||
    email === 'test@example.com' ||
    name.includes('smoke') ||
    name === 'architect jean-paul' ||
    name === 'client marie-claire' ||
    name === 'architect deposit tester' ||
    name === 'vendor deposit tester' ||
    name === 'test'
  ) {
    return true;
  }

  return false;
}

async function removeSmokeUsers() {
  const pool = getPgPool();
  console.log('🔍 Scanning PostgreSQL database for smoke test users...');

  const usersRes = await pool.query('SELECT id, email, name, role FROM "users" ORDER BY created_at ASC;');
  const allUsers = usersRes.rows;

  const smokeUsers = allUsers.filter(isSmokeTestUser);
  const legitimateUsers = allUsers.filter((u) => !isSmokeTestUser(u));

  console.log(`Found ${allUsers.length} total users in database.`);
  console.log(`- Legitimate users to KEEP: ${legitimateUsers.length}`);
  console.log(`- Smoke test users to REMOVE: ${smokeUsers.length}`);

  if (smokeUsers.length === 0) {
    console.log('✨ No smoke test users found. Database is already clean!');
    process.exit(0);
  }

  const smokeIds: string[] = smokeUsers.map((u) => u.id);

  console.log('\n🧹 Cleaning up associated data for smoke test users...');

  // Safe helper to run a cleanup query
  async function safeDelete(description: string, sql: string, params: any[]) {
    try {
      const res = await pool.query(sql, params);
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✓ ${description}: deleted ${res.rowCount} row(s)`);
      }
    } catch (err: any) {
      // Table or column might not have matching rows, log if not simple missing
      console.log(`  ℹ ${description}: ${err.message}`);
    }
  }

  // 1. Projects and related records
  await safeDelete(
    'BOQ items',
    'DELETE FROM "boq_items" WHERE "boq_id" IN (SELECT "id" FROM "boqs" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[])));',
    [smokeIds]
  );
  await safeDelete(
    'BOQs',
    'DELETE FROM "boqs" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Floor plan feedback',
    'DELETE FROM "floor_plan_feedback" WHERE "floor_plan_id" IN (SELECT "id" FROM "floor_plans" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[])));',
    [smokeIds]
  );
  await safeDelete(
    'Floor plans',
    'DELETE FROM "floor_plans" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Project documents',
    'DELETE FROM "documents" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[])) OR "owner_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Chat rooms & messages',
    'DELETE FROM "messages" WHERE "sender_id" = ANY($1::text[]) OR "room_id" IN (SELECT "id" FROM "chat_rooms" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[])));',
    [smokeIds]
  );
  await safeDelete(
    'Chat participants',
    'DELETE FROM "chat_participants" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Chat rooms',
    'DELETE FROM "chat_rooms" WHERE "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Roomagen jobs',
    'DELETE FROM "roomagen_jobs" WHERE "user_id" = ANY($1::text[]) OR "project_id" IN (SELECT "id" FROM "projects" WHERE "owner_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Projects',
    'DELETE FROM "projects" WHERE "owner_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 2. Vendor products & coupons
  await safeDelete(
    'Product media',
    'DELETE FROM "product_media" WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "vendor_id" IN (SELECT "id" FROM "vendor_profiles" WHERE "user_id" = ANY($1::text[])));',
    [smokeIds]
  );
  await safeDelete(
    'Coupons',
    'DELETE FROM "coupons" WHERE "vendor_id" IN (SELECT "id" FROM "vendor_profiles" WHERE "user_id" = ANY($1::text[])) OR "vendor_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Products',
    'DELETE FROM "products" WHERE "vendor_id" IN (SELECT "id" FROM "vendor_profiles" WHERE "user_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Vendor profiles',
    'DELETE FROM "vendor_profiles" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 3. Architect profiles
  await safeDelete(
    'Architect profiles',
    'DELETE FROM "architect_profiles" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 4. Wallets
  await safeDelete(
    'Wallet transactions',
    'DELETE FROM "wallet_transactions" WHERE "vendor_id" = ANY($1::text[]) OR "architect_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Architect wallets',
    'DELETE FROM "architect_wallets" WHERE "architect_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Vendor wallets',
    'DELETE FROM "vendor_wallets" WHERE "vendor_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 5. Carts and Orders
  await safeDelete(
    'Cart items',
    'DELETE FROM "cart_items" WHERE "cart_id" IN (SELECT "id" FROM "carts" WHERE "user_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Carts',
    'DELETE FROM "carts" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Order items',
    'DELETE FROM "order_items" WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "user_id" = ANY($1::text[]));',
    [smokeIds]
  );
  await safeDelete(
    'Orders',
    'DELETE FROM "orders" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 6. Notifications, Reviews, Support, Subscriptions, Payments, Profiles
  await safeDelete(
    'Notifications',
    'DELETE FROM "notifications" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Reviews',
    'DELETE FROM "reviews" WHERE "author_id" = ANY($1::text[]) OR "target_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Support tickets',
    'DELETE FROM "support_tickets" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Subscriptions',
    'DELETE FROM "subscriptions" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Payments',
    'DELETE FROM "payments" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Activities',
    'DELETE FROM "activities" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'Favorites',
    'DELETE FROM "favorites" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );
  await safeDelete(
    'User profiles',
    'DELETE FROM "user_profiles" WHERE "user_id" = ANY($1::text[]);',
    [smokeIds]
  );

  // 7. Finally, delete the smoke users
  console.log(`\n🗑️ Deleting ${smokeIds.length} smoke test users from "users" table...`);
  const delUsers = await pool.query('DELETE FROM "users" WHERE "id" = ANY($1::text[]);', [smokeIds]);
  console.log(`✅ Successfully deleted ${delUsers.rowCount} smoke test users!`);

  // Verification step
  const remainingRes = await pool.query('SELECT id, email, name, role FROM "users" ORDER BY created_at ASC;');
  console.log(`\n--- REMAINING CLEAN USERS IN DATABASE (${remainingRes.rowCount}) ---`);
  for (const u of remainingRes.rows) {
    console.log(`• [${u.role}] ${u.name} (${u.email}) - ID: ${u.id}`);
  }

  process.exit(0);
}

removeSmokeUsers().catch((err) => {
  console.error('❌ Failed to remove smoke test users:', err);
  process.exit(1);
});
