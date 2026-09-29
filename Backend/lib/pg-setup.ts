// BuildSmart AI — PostgreSQL connection setup.
//
// The application now uses a normal PostgreSQL server (node-postgres + the
// Prisma `pg` driver adapter). The connection string is read from the
// environment:
//
//   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
//
// It loads `Frontend/.env.local` for Next.js and the root `.env` for standalone
// npm scripts, so the same config works in both contexts.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

// Load the Next.js env first, then the root `.env` if present. dotenv does not
// override values that already exist, so the most specific file wins.
const candidates = [
  path.resolve("Frontend", ".env.local"),
  path.resolve("Frontend", ".env"),
  path.resolve(".env.local"),
  path.resolve(".env"),
];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ quiet: true, path: candidate });
  }
}

export type PgPool = pg.Pool;

export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to Frontend/.env.local (or .env), for example:\n" +
        "  DATABASE_URL=postgresql://postgres:12345678@localhost:5432/build",
    );
  }
  return url;
}

const g = globalThis as unknown as {
  __buildsmartPgPool?: PgPool;
};

export function getPgPool(): PgPool {
  if (!g.__buildsmartPgPool) {
    g.__buildsmartPgPool = new pg.Pool({ connectionString: getDatabaseUrl() });
    // Prevent an idle pool from crashing the process on a transient network error.
    g.__buildsmartPgPool.on("error", (err) => {
      console.error("[buildsmart:db] PostgreSQL pool error:", err.message);
    });
  }
  return g.__buildsmartPgPool;
}

export async function runBootstrapStatements(pool: PgPool, dir: string): Promise<void> {
  const files = (await fs.promises.readdir(dir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = await fs.promises.readFile(path.join(dir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
  }
}

export async function tableExists(pool: PgPool, table: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT to_regclass($1) AS name`,
    [`public."${table}"`],
  );
  return Boolean(result.rows?.[0]?.name);
}

export async function publicTableCount(pool: PgPool): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) AS "count" FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  return Number(result.rows?.[0]?.count ?? 0);
}

/**
 * Idempotently prepare a connected PostgreSQL database for BuildSmart.
 *
 * The original SQL migrations run only when the database has no tables at all,
 * so a fresh local `build` database is created exactly like the old PGlite
 * database. If the database already contains tables (including a previous
 * BuildSmart deployment), we never run DDL that could drop, rename, or
 * duplicate data. The AI telemetry tables are then created with
 * `CREATE TABLE IF NOT EXISTS`, which is safe to run every time.
 */
export async function ensureDatabaseSchema(pool: PgPool = getPgPool()): Promise<void> {
  const hasUsers = await tableExists(pool, "users");

  if (!hasUsers) {
    const tableCount = await publicTableCount(pool);
    if (tableCount === 0) {
      // The npm scripts run from the repo root; `next dev/start Frontend` runs
      // from the repo root too. In case the process starts inside Frontend/,
      // resolve the migrations against the real project root.
      const projectRoot = fs.existsSync(path.resolve("Backend"))
        ? path.resolve(".")
        : path.resolve("..");
      const dir = path.join(projectRoot, "Backend", "prisma", "legacy-migrations");
      await runBootstrapStatements(pool, dir);
    }
  }

  try {
    await pool.query(`ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "avatar_url" text;`);
    await pool.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "escrow_status" text DEFAULT 'ESCROWED';`);
    await pool.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmation_deadline" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "wallet_id" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'XAF';`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "destination_type" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "destination_reference" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "provider_reference" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "idempotency_key" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "failure_reason" text;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "escrow_id" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "vendor_id" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "client_id" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "reason" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "evidence" jsonb;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "vendor_response" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "vendor_evidence" jsonb;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "vendor_responded_at" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "amount" double precision DEFAULT 0;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolution_type" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "refund_amount" double precision DEFAULT 0;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "release_amount" double precision DEFAULT 0;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolved_by" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "architect_id" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "design_id" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "architect_response" text;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "architect_evidence" jsonb;`);
    await pool.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "architect_responded_at" timestamp with time zone;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "disputes_architect_idx" ON "disputes" USING btree ("architect_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "disputes_design_idx" ON "disputes" USING btree ("design_id");`);

    await pool.query(`ALTER TABLE "withdrawals" ALTER COLUMN "vendor_id" DROP NOT NULL;`);
    await pool.query(`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "architect_id" text;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "withdrawals_architect_idx" ON "withdrawals" USING btree ("architect_id");`);

    await pool.query(`ALTER TABLE "wallet_transactions" ALTER COLUMN "vendor_id" DROP NOT NULL;`);
    await pool.query(`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "architect_id" text;`);
    await pool.query(`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "design_id" text;`);
    await pool.query(`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "project_id" text;`);
    await pool.query(`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "escrow_id" text;`);
    await pool.query(`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "wallet_tx_architect_idx" ON "wallet_transactions" USING btree ("architect_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "wallet_tx_escrow_idx" ON "wallet_transactions" USING btree ("escrow_id");`);

    await pool.query(`ALTER TABLE "escrow_transactions" ALTER COLUMN "order_id" DROP NOT NULL;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ALTER COLUMN "vendor_id" DROP NOT NULL;`);
    // In PostgreSQL, dropping UNIQUE from order_id if it was created inline as UNIQUE:
    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE "escrow_transactions" DROP CONSTRAINT IF EXISTS "escrow_transactions_order_id_key";
      EXCEPTION
        WHEN undefined_object THEN NULL;
      END $$;
    `);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "escrow_type" text NOT NULL DEFAULT 'VENDOR';`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "architect_id" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "project_id" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "design_id" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "milestone_id" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "revision_count" integer NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "max_revisions" integer NOT NULL DEFAULT 2;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "unlocked_at" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "acceptance_deadline" timestamp with time zone;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "release_reason" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "content_hash" text;`);
    await pool.query(`ALTER TABLE "escrow_transactions" ADD COLUMN IF NOT EXISTS "auto_release_eligible" boolean NOT NULL DEFAULT true;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "escrow_tx_architect_idx" ON "escrow_transactions" USING btree ("architect_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "escrow_tx_design_idx" ON "escrow_transactions" USING btree ("design_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "escrow_tx_project_idx" ON "escrow_transactions" USING btree ("project_id");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "escrow_tx_type_idx" ON "escrow_transactions" USING btree ("escrow_type");`);
  } catch (err: any) {
    // Ignore if table doesn't exist yet or already has column
    console.warn("[buildsmart:db] Column alter warning:", err.message);
  }

  const walletEscrowStatements = [
    `CREATE TABLE IF NOT EXISTS "vendor_wallets" (
      "id" text PRIMARY KEY,
      "vendor_id" text NOT NULL UNIQUE,
      "currency" text NOT NULL DEFAULT 'XAF',
      "available_balance" double precision NOT NULL DEFAULT 0,
      "escrow_balance" double precision NOT NULL DEFAULT 0,
      "pending_withdrawal_balance" double precision NOT NULL DEFAULT 0,
      "withdrawn_amount" double precision NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "vendor_wallets_vendor_idx" ON "vendor_wallets" USING btree ("vendor_id")`,
    `CREATE TABLE IF NOT EXISTS "architect_wallets" (
      "id" text PRIMARY KEY,
      "architect_id" text NOT NULL UNIQUE,
      "currency" text NOT NULL DEFAULT 'XAF',
      "available_balance" double precision NOT NULL DEFAULT 0,
      "escrow_balance" double precision NOT NULL DEFAULT 0,
      "pending_withdrawal_balance" double precision NOT NULL DEFAULT 0,
      "withdrawn_amount" double precision NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "architect_wallets_architect_idx" ON "architect_wallets" USING btree ("architect_id")`,
    `CREATE TABLE IF NOT EXISTS "wallet_transactions" (
      "id" text PRIMARY KEY,
      "wallet_id" text NOT NULL,
      "vendor_id" text,
      "architect_id" text,
      "order_id" text,
      "design_id" text,
      "project_id" text,
      "escrow_id" text,
      "dispute_id" text,
      "withdrawal_id" text,
      "idempotency_key" text,
      "transaction_type" text NOT NULL,
      "amount" double precision NOT NULL,
      "fee" double precision NOT NULL DEFAULT 0,
      "net_amount" double precision NOT NULL DEFAULT 0,
      "currency" text NOT NULL DEFAULT 'XAF',
      "status" text NOT NULL DEFAULT 'COMPLETED',
      "balance_before" double precision,
      "balance_after" double precision,
      "reference" text,
      "description" text,
      "metadata" jsonb,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "wallet_tx_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id")`,
    `CREATE INDEX IF NOT EXISTS "wallet_tx_vendor_idx" ON "wallet_transactions" USING btree ("vendor_id")`,
    `CREATE INDEX IF NOT EXISTS "wallet_tx_architect_idx" ON "wallet_transactions" USING btree ("architect_id")`,
    `CREATE INDEX IF NOT EXISTS "wallet_tx_order_idx" ON "wallet_transactions" USING btree ("order_id")`,
    `CREATE INDEX IF NOT EXISTS "wallet_tx_created_idx" ON "wallet_transactions" USING btree ("created_at")`,
    `CREATE TABLE IF NOT EXISTS "escrow_transactions" (
      "id" text PRIMARY KEY,
      "escrow_type" text NOT NULL DEFAULT 'VENDOR',
      "order_id" text,
      "wallet_id" text NOT NULL,
      "vendor_id" text,
      "architect_id" text,
      "client_id" text NOT NULL,
      "project_id" text,
      "design_id" text,
      "milestone_id" text,
      "payment_id" text,
      "amount" double precision NOT NULL,
      "platform_fee" double precision NOT NULL DEFAULT 0,
      "gross_amount" double precision NOT NULL,
      "currency" text NOT NULL DEFAULT 'XAF',
      "status" text NOT NULL DEFAULT 'ESCROWED',
      "revision_count" integer NOT NULL DEFAULT 0,
      "max_revisions" integer NOT NULL DEFAULT 2,
      "funded_at" timestamp with time zone,
      "delivered_at" timestamp with time zone,
      "unlocked_at" timestamp with time zone,
      "confirmation_deadline" timestamp with time zone,
      "acceptance_deadline" timestamp with time zone,
      "released_at" timestamp with time zone,
      "refunded_at" timestamp with time zone,
      "disputed_at" timestamp with time zone,
      "release_reason" text,
      "content_hash" text,
      "auto_release_eligible" boolean NOT NULL DEFAULT true,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_order_idx" ON "escrow_transactions" USING btree ("order_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_vendor_idx" ON "escrow_transactions" USING btree ("vendor_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_architect_idx" ON "escrow_transactions" USING btree ("architect_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_client_idx" ON "escrow_transactions" USING btree ("client_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_project_idx" ON "escrow_transactions" USING btree ("project_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_design_idx" ON "escrow_transactions" USING btree ("design_id")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_status_idx" ON "escrow_transactions" USING btree ("status")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_deadline_idx" ON "escrow_transactions" USING btree ("confirmation_deadline")`,
    `CREATE INDEX IF NOT EXISTS "escrow_tx_acc_deadline_idx" ON "escrow_transactions" USING btree ("acceptance_deadline")`,
    `CREATE TABLE IF NOT EXISTS "design_revisions" (
      "id" text PRIMARY KEY,
      "escrow_id" text NOT NULL,
      "design_id" text NOT NULL,
      "project_id" text,
      "client_id" text NOT NULL,
      "architect_id" text NOT NULL,
      "revision_number" integer NOT NULL DEFAULT 1,
      "client_request" text NOT NULL,
      "architect_response" text,
      "status" text NOT NULL DEFAULT 'REQUESTED',
      "attachments" jsonb,
      "submitted_at" timestamp with time zone,
      "reviewed_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "design_revisions_escrow_idx" ON "design_revisions" USING btree ("escrow_id")`,
    `CREATE INDEX IF NOT EXISTS "design_revisions_design_idx" ON "design_revisions" USING btree ("design_id")`,
    `CREATE INDEX IF NOT EXISTS "design_revisions_architect_idx" ON "design_revisions" USING btree ("architect_id")`,
  ];
  for (const statement of walletEscrowStatements) {
    await pool.query(statement);
  }

  const aiStatements = [
    `CREATE TABLE IF NOT EXISTS "ai_conversations" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL,
      "title" text NOT NULL DEFAULT 'New conversation',
      "mode" text NOT NULL DEFAULT 'architecture',
      "project_id" text,
      "context" jsonb,
      "status" text NOT NULL DEFAULT 'ACTIVE',
      "message_count" integer NOT NULL DEFAULT 0,
      "last_message_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_messages" (
      "id" text PRIMARY KEY,
      "conversation_id" text NOT NULL,
      "user_id" text NOT NULL,
      "role" text NOT NULL,
      "content" text NOT NULL,
      "category" text,
      "model" text,
      "token_count" integer,
      "feedback" text,
      "feedback_reason" text,
      "meta" jsonb,
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_feedback" (
      "id" text PRIMARY KEY,
      "conversation_id" text NOT NULL,
      "message_id" text NOT NULL,
      "user_id" text NOT NULL,
      "rating" text NOT NULL,
      "reason" text,
      "comment" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_tool_executions" (
      "id" text PRIMARY KEY,
      "conversation_id" text,
      "user_id" text NOT NULL,
      "tool" text NOT NULL,
      "input" jsonb,
      "output_summary" text,
      "status" text NOT NULL DEFAULT 'SUCCESS',
      "error" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL,
      "conversation_id" text,
      "category" text,
      "model" text,
      "status" text NOT NULL DEFAULT 'SUCCESS',
      "token_count" integer,
      "latency_ms" integer,
      "error_category" text,
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_conversations_user_updated_idx" ON "ai_conversations" USING btree ("user_id", "updated_at")`,
    `CREATE INDEX IF NOT EXISTS "ai_conversations_project_idx" ON "ai_conversations" USING btree ("project_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_messages_user_idx" ON "ai_messages" USING btree ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_messages_created_idx" ON "ai_messages" USING btree ("created_at")`,
    `CREATE INDEX IF NOT EXISTS "ai_feedback_user_idx" ON "ai_feedback" USING btree ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_feedback_conversation_idx" ON "ai_feedback" USING btree ("conversation_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_feedback_message_idx" ON "ai_feedback" USING btree ("message_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_tools_user_idx" ON "ai_tool_executions" USING btree ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_tools_conversation_idx" ON "ai_tool_executions" USING btree ("conversation_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_usage_user_time_idx" ON "ai_usage_logs" USING btree ("user_id", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "ai_usage_conversation_idx" ON "ai_usage_logs" USING btree ("conversation_id")`,
    `CREATE INDEX IF NOT EXISTS "ai_usage_category_idx" ON "ai_usage_logs" USING btree ("category")`,
  ];
  for (const statement of aiStatements) {
    await pool.query(statement);
  }

  const roomagenStatements = [
    `CREATE TABLE IF NOT EXISTS "roomagen_jobs" (
      "id" text PRIMARY KEY,
      "project_id" text,
      "user_id" text NOT NULL,
      "architect_id" text,
      "roomagen_job_id" text UNIQUE,
      "tool" text NOT NULL,
      "status" text NOT NULL DEFAULT 'PENDING',
      "input_asset_url" text,
      "output_asset_url" text,
      "input_asset_id" text,
      "output_asset_id" text,
      "version" integer NOT NULL DEFAULT 1,
      "prompt" text,
      "options" jsonb,
      "metadata" jsonb,
      "error_message" text,
      "provider" text NOT NULL DEFAULT 'roomagen',
      "completed_at" timestamp with time zone,
      "failed_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "roomagen_jobs_project_idx" ON "roomagen_jobs" USING btree ("project_id")`,
    `CREATE INDEX IF NOT EXISTS "roomagen_jobs_user_idx" ON "roomagen_jobs" USING btree ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "roomagen_jobs_provider_job_idx" ON "roomagen_jobs" USING btree ("roomagen_job_id")`,
    `CREATE INDEX IF NOT EXISTS "roomagen_jobs_status_idx" ON "roomagen_jobs" USING btree ("status")`,
    `CREATE INDEX IF NOT EXISTS "roomagen_jobs_created_idx" ON "roomagen_jobs" USING btree ("created_at")`,
  ];
  for (const statement of roomagenStatements) {
    await pool.query(statement);
  }
}

