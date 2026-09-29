// BuildSmart AI — Prisma/PostgreSQL seed entrypoint.
//
// The previous Drizzle/PGlite seed has been replaced by the idempotent
// `seedIfEmpty()` logic in `Backend/lib/db.ts`. It is safe to run any time:
//   - On an empty database it creates the demo users, profiles, products,
//     project, floor plans and blog post used by the UI.
//   - On a database that already contains data it does nothing, so users may
//     run `npm run db:seed` before or after the app without losing rows.
//
// To intentionally rebuild demo data (not required for normal use):
//   npm run db:seed -- --reset
import path from "node:path";
import dotenv from "dotenv";
import { dbClient, ensureSeeded, getPrisma, resetAndSeed } from "./db.ts";

// Standalone Node scripts should read the same local env as the Next.js app.
dotenv.config({ path: path.resolve(process.cwd(), "Frontend/.env.local") });

const MODEL_KEYS = [
  "user", "userProfile", "architectProfile", "vendorProfile", "product",
  "project", "floorPlan", "cart", "cartItem", "chatRoom", "chatParticipant",
  "message", "order", "orderItem", "notification", "review", "blogPost",
  "supportTicket", "subscription", "payment", "document", "productMedia",
  "warehouse", "warehouseStock", "coupon", "campaign", "crossSell",
  "returnRequest", "withdrawal", "inquiry", "vendorTraffic", "designRequest",
  "design", "appointment", "boq", "boqItem", "transaction", "activity",
  "floorPlanFeedback", "favorite", "invoice", "auditLog", "securityEvent",
  "report", "dispute", "announcement", "faq", "platformSetting", "adminRole",
  "aiConversation", "aiMessage", "aiFeedback", "aiToolExecution", "aiUsageLog",
] as const;

async function main() {
  const reset = process.argv.includes("--reset");
  const prisma = await getPrisma();

  if (reset) {
    console.log("♻️  Resetting BuildSmart demo data...");
    await resetAndSeed();
  } else {
    await ensureSeeded();
  }

  const counts: Record<string, number> = {};
  for (const key of MODEL_KEYS) {
    try {
      const rows = await (dbClient as any)[key].findMany({ where: {} });
      counts[key] = rows.length;
    } catch {
      counts[key] = 0;
    }
  }

  console.log("✅ BuildSmart database ready.");
  console.log(JSON.stringify(counts, null, 2));

  await prisma.$disconnect();

  // The pg pool keeps the CLI process alive after Prisma disconnects, so an
  // explicit exit is required for a one-shot script.
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
