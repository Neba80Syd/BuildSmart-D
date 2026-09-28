// BuildSmart AI — data layer.
// Backed by Prisma ORM + the node-postgres (`pg`) driver adapter.
//
// This file intentionally keeps the same high-level `dbClient` API that the
// rest of the application already uses, so replacing the storage layer does not
// require changes in the 1,000+ call sites across pages and routes.
//
// It connects to a standard PostgreSQL server using DATABASE_URL from .env.
// Tables are only bootstrapped on a fresh database; when any table already
// exists we never run CREATE TABLE against it again, so existing local data is
// never dropped, renamed, or duplicated.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { ensureDatabaseSchema, getPgPool, type PgPool } from "./pg-setup.ts";

type Any = Record<string, any>;

// Standalone scripts and the Prisma CLI need the same env as the Next.js app.
// In Next.js (cwd = Frontend/) this resolves to Frontend/.env.local; from the
// repo root it resolves to the same file via the Frontend sub-directory.
const localEnv = path.join("Frontend", ".env.local");
const localEnvPath = fs.existsSync(path.resolve(localEnv))
  ? path.resolve(localEnv)
  : path.resolve(".env");
dotenv.config({ quiet: true, path: localEnvPath });

const g = globalThis as unknown as {
  __buildsmartPrisma?: Promise<PrismaClient>;
};

const DEMO_HASH = "$2b$10$42NyCpnYkxiNEJXiTqnGTedDMCUd4K/.LiYe7gnHfT.G18pVIo3pW";

// Demo rows identical to the former seedIfEmpty so a fresh PostgreSQL
// database is immediately usable before `npm run db:seed` is run.
async function seedIfEmpty(prisma: PrismaClient) {
  const existing = await prisma.user.count();
  if (existing > 0) return;

  const now = new Date();
  await prisma.user.createMany({
    data: [
      { id: "u_client", email: "jordan@buildsmart.ai", name: "Jordan Ellis", role: "CLIENT", passwordHash: DEMO_HASH, emailVerified: true, status: "ACTIVE", createdAt: now },
      { id: "u_architect", email: "elena@buildsmart.ai", name: "Elena Voss", role: "ARCHITECT", passwordHash: DEMO_HASH, emailVerified: true, status: "ACTIVE", createdAt: now },
      { id: "u_vendor", email: "marcus@buildsmart.ai", name: "Marcus Hale", role: "VENDOR", passwordHash: DEMO_HASH, emailVerified: true, status: "ACTIVE", createdAt: now },
      { id: "u_admin", email: "admin@buildsmart.ai", name: "BuildSmart Admin", role: "ADMIN", passwordHash: DEMO_HASH, emailVerified: true, status: "ACTIVE", createdAt: now },
    ],
  });
  await prisma.userProfile.createMany({
    data: [
      { id: "up_client", userId: "u_client", location: "Douala, Cameroon", bio: "Client building a modern family home." },
      { id: "up_architect", userId: "u_architect", location: "Douala, Cameroon", bio: "Award-winning architect specialising in sustainable design." },
      { id: "up_vendor", userId: "u_vendor", location: "Douala, Cameroon", bio: "Building materials supplier." },
      { id: "up_admin", userId: "u_admin", location: "Douala, Cameroon", bio: "Platform administrator." },
    ],
  });
  await prisma.architectProfile.create({
    data: {
      id: "ap_1",
      userId: "u_architect",
      biography: "Elena designs climate-responsive homes and offices across West and Central Africa.",
      specializations: '["Residential","Sustainable Design","Office Spaces"]',
      experience: 12,
      licenseNumber: "ONIGC-2012-0148",
      verificationStatus: "VERIFIED",
      verifiedAt: now,
      rating: 4.9,
      reviewCount: 34,
      portfolio: '[{"title":"Riverside Villa","year":2024,"image":"/images/project-villa.png"},{"title":"Harbor Office Tower","year":2023,"image":"/images/project-eco-office.png"}]',
      location: "Douala, Cameroon",
      hourlyRate: 25000,
      title: "Principal Architect & Sustainability Lead",
      languages: ["English", "French"],
      serviceAreas: ["Douala", "Yaoundé", "Kribi"],
      visibility: "PUBLIC",
    },
  });
  await prisma.vendorProfile.create({
    data: {
      id: "vp_1",
      userId: "u_vendor",
      businessName: "Prime Materials EU",
      description: "Importer of premium European building materials and finishes.",
      location: "Douala, Cameroon",
      registrationNumber: "RC/DLA/2018/B/4421",
      verificationLevel: "VERIFIED_VENDOR",
      verificationStatus: "FULLY_VERIFIED",
      verifiedAt: now,
      rating: 4.6,
      reviewCount: 18,
    },
  });
  await prisma.product.createMany({
    data: [
      { id: "prod_1", vendorId: "vp_1", name: "Portland Cement 50kg", category: "Cement", unit: "bag", price: 4500, stock: 500, isActive: true, tags: ["cement", "binder"], attributes: { brand: "Lafarge", grade: "42.5R" }, createdAt: now },
      { id: "prod_2", vendorId: "vp_1", name: "Steel Rebar 12mm", category: "Steel", unit: "length", price: 6800, stock: 200, isActive: true, tags: ["steel", "rebar"], attributes: { diameter: "12mm", grade: "B500B" }, createdAt: now },
      { id: "prod_3", vendorId: "vp_1", name: "Ceramic Floor Tile 60x60", category: "Tiles", unit: "m2", price: 8500, stock: 1000, isActive: true, tags: ["tiles", "flooring"], attributes: { size: "60x60cm" }, createdAt: now },
    ],
  });
  await prisma.project.create({
    data: {
      id: "proj_1",
      name: "Riverside Villa",
      description: "Four-bedroom modern villa with river views.",
      status: "CLIENT_REVIEW",
      ownerId: "u_client",
      architectId: "u_architect",
      budget: 85000000,
      location: "Bonapriso, Douala",
      progress: 68,
      projectType: "Villa",
      siteArea: 600,
      floors: 2,
      rooms: 9,
      style: "Modern Tropical",
      requirements: ["River views", "Double-height living room", "Solar-ready roof"],
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.floorPlan.createMany({
    data: [
      {
        id: "fp_1",
        projectId: "proj_1",
        name: "Ground Floor Plan",
        data: JSON.stringify({ rooms: [{ id: "living", name: "Living Room", x: 0, y: 0, w: 6, h: 4.8 }, { id: "kitchen", name: "Kitchen", x: 6.6, y: 0, w: 3.8, h: 3.2 }] }),
        svgData: "floorplan",
        kind: "2D",
        version: 3,
        status: "PUBLISHED",
        reviewStatus: "APPROVED",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "fp3d_1",
        projectId: "proj_1",
        name: "3D Floorplan V1",
        data: JSON.stringify({ rooms: [{ id: "living", name: "Living Room", x: 0, y: 0, w: 6, h: 4.8 }, { id: "kitchen", name: "Kitchen", x: 6.6, y: 0, w: 3.8, h: 3.2 }] }),
        svgData: "3d",
        kind: "3D",
        version: 1,
        status: "PUBLISHED",
        reviewStatus: "READY_FOR_REVIEW",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  await prisma.blogPost.create({
    data: {
      id: "blog_1",
      title: "Sustainable Concrete for Tropical Climates",
      slug: "sustainable-concrete-tropical",
      category: "Materials",
      excerpt: "Choosing the right mix to resist humidity and heat.",
      content: "Full article content on sustainable concrete mixes in tropical climates.",
      author: "Elena Voss",
      status: "PUBLISHED",
      createdAt: now,
      publishedAt: now,
    },
  });

  console.log("[buildsmart] Seeded demo data into the PostgreSQL database.");
}

// Editorial content used by the public marketing blog. These are inserted
// idempotently (never overwrite existing rows) so the public pages look
// complete on a fresh local install while preserving any content the admin
// already created.
export const BLOG_POSTS = [
  {
    id: "blog_1",
    title: "Sustainable Concrete for Tropical Climates",
    slug: "sustainable-concrete-tropical",
    category: "Building Materials",
    excerpt:
      "Choosing the right concrete mix to resist humidity, heat, and intense rainfall in tropical regions.",
    coverImage: "/images/project-floorplan.png",
    author: "Elena Voss",
    content:
      "Tropical construction demands more than strong concrete. It demands a material that behaves well under continuous humidity, high temperatures, and moisture-driven movement.\n\nThe mix design matters as much as the structure. Lower water content, supplementary cementitious materials, and careful curing all reduce cracking and improve durability in demanding climates.\n\nAt BuildSmart AI, material recommendations are linked directly to the site context and project budget, so the specification stays practical and honest.\n\nA truly sustainable tropical building relies on the right mix, the right detail, and a maintenance plan that respects the environment.",
    publishedAt: new Date("2026-05-05T12:00:00.000Z"),
  },
  {
    id: "blog_2",
    title: "How AI is Transforming Architectural Concept Design",
    slug: "how-ai-transforming-architectural-concept-design",
    category: "AI & Architecture",
    excerpt:
      "Generative design is no longer a lab experiment. Here is how AI is helping architects explore more options without sacrificing craft.",
    coverImage: "/images/hero-villa.png",
    author: "Elena Voss",
    content:
      "The first sketch is no longer the only starting point. Modern architectural workflows increasingly begin with a conversation: client brief, site constraints, climate data, material preferences.\n\nBuildSmart AI turns that conversation into a range of concept directions. Each option respects the brief while revealing spatial relationships, orientation, daylight, and structural logic that might not appear in an hour of pencil sketching.\n\nWhat makes this valuable is not automation for its own sake. It is the ability to think alongside the machine: explore fifty variations, reject weak ones quickly, and arrive at a stronger design much earlier in the process.\n\nThe best outcome is not an AI-generated building. It is a human-designed building supported by tools powerful enough to keep imagination moving faster.",
    publishedAt: new Date("2026-08-18T09:00:00.000Z"),
  },
  {
    id: "blog_3",
    title: "Building Sustainably in Tropical Climates",
    slug: "building-sustainably-in-tropical-climates",
    category: "Construction",
    excerpt:
      "Passive cooling, cross-ventilation, and materials that breathe — a practical guide to climate-responsive construction.",
    coverImage: "/images/project-eco-office.png",
    author: "BuildSmart Editorial",
    content:
      "A building in a tropical climate has a very different job than one designed for a temperate season. The envelope, the openings, and the pace of material moisture all need to respond to heat, humidity, and intense rainfall.\n\nStart with orientation. Long facades facing the sun capture heat that must then be removed by mechanical cooling. Deep verandas, shaded openings, and planted screens can cut that load dramatically.\n\nVentilation is equally important. Cross-ventilation corridors, operable high-level windows, and open stairwells let airflow move through the building naturally, especially in the early evening when the interior warms faster than the outside.\n\nFinally, choose materials with a low embodied carbon and a good relationship with moisture. Local stone, thermally efficient blockwork, and breathable finishes all perform well when detailed carefully.\n\nSustainability in the tropics is not a style. It is careful geometry, patient detailing, and honest material choices that make comfort affordable over decades.",
    publishedAt: new Date("2026-07-30T10:00:00.000Z"),
  },
  {
    id: "blog_4",
    title: "From Sketch to Bill of Quantities in Minutes",
    slug: "from-sketch-to-bill-of-quantities-in-minutes",
    category: "Project Management",
    excerpt:
      "The fastest reliable way to move a concept drawing into a construction-ready cost plan.",
    coverImage: "/images/blueprint-ai.png",
    author: "Jordan Ellis",
    content:
      "Cost certainty is one of the biggest risks in construction. Traditional estimating often happens after design decisions are locked, leaving little room to react.\n\nBuildSmart AI approaches estimation differently. As a floor plan takes shape, the system reads walls, openings, rooms, and finishes, then translates them into quantities that can be priced against real market data.\n\nBecause the estimate updates with the design, architects and clients can make choices while the cost is still flexible. A slightly smaller kitchen, a different tile, or a more efficient structural grid can be compared instantly.\n\nThe result is a Bill of Quantities that moves with the project, not behind it. That saves weeks of manual measurement and gives every stakeholder the same honest picture.",
    publishedAt: new Date("2026-07-12T08:30:00.000Z"),
  },
  {
    id: "blog_5",
    title: "Why 3D Visualisation Speeds Up Client Approvals",
    slug: "why-3d-visualisation-speeds-up-client-approvals",
    category: "Architectural Design",
    excerpt:
      "A well-timed 3D preview removes ambiguity and keeps design decisions moving forward.",
    coverImage: "/images/hero-interior.png",
    author: "BuildSmart Editorial",
    content:
      "Words and dimensions describe a design. A 3D preview lets a client experience it.\n\nEven early in a project, a simple massing study can align expectations about scale, light, and layout. When clients can walk through a space, they stop interpreting drawings and start reacting to the building itself.\n\nThat emotional clarity makes approval conversations shorter. Questions become concrete again: this room feels small, or that view will be wonderful.\n\nBy linking the 3D model to the same data used for floor plans and quantities, BuildSmart AI ensures the visual is not a deceptive render detached from the actual project. What the client sees is what the team is building.",
    publishedAt: new Date("2026-06-24T09:30:00.000Z"),
  },
  {
    id: "blog_6",
    title: "Choosing the Right Materials for a Modern Family Home",
    slug: "choosing-the-right-materials-for-a-modern-family-home",
    category: "Building Materials",
    excerpt:
      "A practical framework for balancing durability, appearance, budget, and long-term maintenance.",
    coverImage: "/images/project-villa.png",
    author: "Marcus Hale",
    content:
      "Material decisions are lifestyle decisions. A family home has to look good on day one and still feel good after years of use.\n\nThink about maintenance first, not last. A beautiful timber deck is a pleasure to present and a chore to maintain. Concrete and ceramic floors, on the other hand, tolerate busy family life with very little effort.\n\nNext, consider climate. In a humid tropical setting, porous materials can absorb moisture and encourage mould unless the detail is right. Breathable walls, fast-drying render, and quality coatings help a house stay healthy.\n\nBudget should follow the same logic as design: spend on what you touch and use daily, and save on what is hidden. High-quality windows, durable handles, and well-sealed doors make more difference to everyday life than a glamorous but fragile feature wall.\n\nGood architecture is not about using the most expensive materials. It is about choosing materials that behave well for decades.",
    publishedAt: new Date("2026-06-05T11:00:00.000Z"),
  },
  {
    id: "blog_7",
    title: "Inside the BuildSmart Marketplace: Procure Like a Pro",
    slug: "inside-the-buildsmart-marketplace",
    category: "Project Management",
    excerpt:
      "From BOQ to verified supplier, discover how integrated procurement removes friction from construction buying.",
    coverImage: "/images/marketplace-hero.png",
    author: "BuildSmart Editorial",
    content:
      "Procurement is where design ambition meets reality. A missing quotation or a delayed delivery can stop a project for weeks.\n\nBuildSmart Marketplace brings the project data and the supplier network together. An architect can push a Bill of Quantities directly into the marketplace, and verified vendors respond with prices for the exact products and quantities listed.\n\nBuyers see comparable options in one place, with product attributes, pricing, and stock levels available before the order is placed. This reduces back-and-forth emails, avoids approximate pricing, and creates an auditable trail.\n\nFor vendors, the marketplace is a smarter storefront. They receive precise, relevant demand instead of generic enquiries, and can manage inventory, campaigns, and reviews from one professional dashboard.\n\nProcurement should feel less like admin and more like a natural extension of good design. That is the goal.",
    publishedAt: new Date("2026-05-19T13:00:00.000Z"),
  },
];

async function ensureBlogPosts(prisma: PrismaClient) {
  const existing = await prisma.blogPost.findMany({
    select: { id: true, slug: true, coverImage: true, status: true, publishedAt: true },
  });
  const byId = new Map(existing.map((post) => [post.id, post]));
  const bySlug = new Map(existing.map((post) => [post.slug, post]));

  // Insert only posts that do not exist at all (by id or slug). New posts are
  // always published since they are curated editorial content.
  const missing = BLOG_POSTS.filter(
    (post) => !byId.has(post.id) && !bySlug.has(post.slug),
  ).map((post) => ({ ...post, status: "PUBLISHED", createdAt: post.publishedAt }));
  if (missing.length) {
    await prisma.blogPost.createMany({ data: missing, skipDuplicates: true });
  }

  // For existing curated posts, fill only the public-facing presentation
  // fields. We deliberately do NOT change status here, so an admin who
  // later unpublishes an article keeps that decision across restarts.
  for (const post of BLOG_POSTS) {
    const row = byId.get(post.id) ?? bySlug.get(post.slug);
    if (!row) continue;
    const data: any = {};
    if (!row.coverImage) data.coverImage = post.coverImage;
    if (!row.publishedAt) data.publishedAt = post.publishedAt;
    if (Object.keys(data).length) {
      await prisma.blogPost.updateMany({ where: { id: row.id }, data });
    }
  }
}

// ---------------------------------------------------------------------------
// Wallet & Escrow Fallback Delegates (resilient direct pg.Pool access)
// ---------------------------------------------------------------------------
export function mapWallet(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    vendorId: row.vendor_id,
    currency: row.currency || "XAF",
    availableBalance: Number(row.available_balance ?? 0),
    escrowBalance: Number(row.escrow_balance ?? 0),
    pendingWithdrawalBalance: Number(row.pending_withdrawal_balance ?? 0),
    withdrawnAmount: Number(row.withdrawn_amount ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapArchitectWallet(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    architectId: row.architect_id,
    currency: row.currency || "XAF",
    availableBalance: Number(row.available_balance ?? 0),
    escrowBalance: Number(row.escrow_balance ?? 0),
    pendingWithdrawalBalance: Number(row.pending_withdrawal_balance ?? 0),
    withdrawnAmount: Number(row.withdrawn_amount ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWalletTx(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    walletId: row.wallet_id,
    vendorId: row.vendor_id ?? null,
    architectId: row.architect_id ?? null,
    orderId: row.order_id ?? null,
    designId: row.design_id ?? null,
    projectId: row.project_id ?? null,
    escrowId: row.escrow_id ?? null,
    disputeId: row.dispute_id ?? null,
    withdrawalId: row.withdrawal_id ?? null,
    idempotencyKey: row.idempotency_key ?? null,
    transactionType: row.transaction_type,
    amount: Number(row.amount ?? 0),
    fee: Number(row.fee ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    currency: row.currency || "XAF",
    status: row.status,
    balanceBefore: row.balance_before !== null && row.balance_before !== undefined ? Number(row.balance_before) : null,
    balanceAfter: row.balance_after !== null && row.balance_after !== undefined ? Number(row.balance_after) : null,
    reference: row.reference,
    description: row.description,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata ?? null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEscrow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    escrowType: row.escrow_type || "VENDOR",
    orderId: row.order_id ?? null,
    walletId: row.wallet_id,
    vendorId: row.vendor_id ?? null,
    architectId: row.architect_id ?? null,
    clientId: row.client_id,
    projectId: row.project_id ?? null,
    designId: row.design_id ?? null,
    milestoneId: row.milestone_id ?? null,
    paymentId: row.payment_id ?? null,
    amount: Number(row.amount ?? 0),
    platformFee: Number(row.platform_fee ?? 0),
    grossAmount: Number(row.gross_amount ?? 0),
    currency: row.currency || "XAF",
    status: row.status,
    revisionCount: Number(row.revision_count ?? 0),
    maxRevisions: Number(row.max_revisions ?? 2),
    fundedAt: row.funded_at,
    deliveredAt: row.delivered_at,
    unlockedAt: row.unlocked_at,
    confirmationDeadline: row.confirmation_deadline,
    acceptanceDeadline: row.acceptance_deadline,
    releasedAt: row.released_at,
    refundedAt: row.refunded_at,
    disputedAt: row.disputed_at,
    releaseReason: row.release_reason ?? null,
    contentHash: row.content_hash ?? null,
    autoReleaseEligible: Boolean(row.auto_release_eligible),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDesignRevision(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    escrowId: row.escrow_id,
    designId: row.design_id,
    projectId: row.project_id ?? null,
    clientId: row.client_id,
    architectId: row.architect_id,
    revisionNumber: Number(row.revision_number ?? 1),
    clientRequest: row.client_request,
    architectResponse: row.architect_response ?? null,
    status: row.status || "REQUESTED",
    attachments: typeof row.attachments === "string" ? JSON.parse(row.attachments) : (row.attachments ?? null),
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createVendorWalletDelegate(pool: PgPool) {
  return {
    async findUnique({ where }: any) {
      const col = where.vendorId !== undefined ? "vendor_id" : "id";
      const val = where.vendorId !== undefined ? where.vendorId : where.id;
      const res = await pool.query(`SELECT * FROM "vendor_wallets" WHERE "${col}" = $1 LIMIT 1`, [val]);
      return res.rows[0] ? mapWallet(res.rows[0]) : null;
    },
    async findFirst(args: any = {}) {
      return this.findUnique(args);
    },
    async create({ data }: any) {
      const id = data.id || ("w_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "vendor_wallets" (
          "id", "vendor_id", "currency", "available_balance", "escrow_balance", "pending_withdrawal_balance", "withdrawn_amount", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          id,
          data.vendorId,
          data.currency || "XAF",
          Number(data.availableBalance ?? 0),
          Number(data.escrowBalance ?? 0),
          Number(data.pendingWithdrawalBalance ?? 0),
          Number(data.withdrawnAmount ?? 0),
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapWallet(res.rows[0]);
    },
    async update({ where, data }: any) {
      const col = where.vendorId !== undefined ? "vendor_id" : "id";
      const val = where.vendorId !== undefined ? where.vendorId : where.id;
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.currency !== undefined) { sets.push(`"currency" = $${idx++}`); params.push(data.currency); }
      if (data.availableBalance !== undefined) { sets.push(`"available_balance" = $${idx++}`); params.push(Number(data.availableBalance)); }
      if (data.escrowBalance !== undefined) { sets.push(`"escrow_balance" = $${idx++}`); params.push(Number(data.escrowBalance)); }
      if (data.pendingWithdrawalBalance !== undefined) { sets.push(`"pending_withdrawal_balance" = $${idx++}`); params.push(Number(data.pendingWithdrawalBalance)); }
      if (data.withdrawnAmount !== undefined) { sets.push(`"withdrawn_amount" = $${idx++}`); params.push(Number(data.withdrawnAmount)); }
      sets.push(`"updated_at" = $${idx++}`); params.push(data.updatedAt || new Date());
      params.push(val);
      const res = await pool.query(
        `UPDATE "vendor_wallets" SET ${sets.join(", ")} WHERE "${col}" = $${idx} RETURNING *`,
        params
      );
      return res.rows[0] ? mapWallet(res.rows[0]) : null;
    },
    async findMany() {
      const res = await pool.query(`SELECT * FROM "vendor_wallets" ORDER BY "created_at" DESC`);
      return res.rows.map(mapWallet);
    },
  };
}

export function createArchitectWalletDelegate(pool: PgPool) {
  return {
    async findUnique({ where }: any) {
      const col = where.architectId !== undefined ? "architect_id" : "id";
      const val = where.architectId !== undefined ? where.architectId : where.id;
      const res = await pool.query(`SELECT * FROM "architect_wallets" WHERE "${col}" = $1 LIMIT 1`, [val]);
      return res.rows[0] ? mapArchitectWallet(res.rows[0]) : null;
    },
    async findFirst(args: any = {}) {
      return this.findUnique(args);
    },
    async create({ data }: any) {
      const id = data.id || ("aw_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "architect_wallets" (
          "id", "architect_id", "currency", "available_balance", "escrow_balance", "pending_withdrawal_balance", "withdrawn_amount", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          id,
          data.architectId,
          data.currency || "XAF",
          Number(data.availableBalance ?? 0),
          Number(data.escrowBalance ?? 0),
          Number(data.pendingWithdrawalBalance ?? 0),
          Number(data.withdrawnAmount ?? 0),
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapArchitectWallet(res.rows[0]);
    },
    async update({ where, data }: any) {
      const col = where.architectId !== undefined ? "architect_id" : "id";
      const val = where.architectId !== undefined ? where.architectId : where.id;
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.currency !== undefined) { sets.push(`"currency" = $${idx++}`); params.push(data.currency); }
      if (data.availableBalance !== undefined) { sets.push(`"available_balance" = $${idx++}`); params.push(Number(data.availableBalance)); }
      if (data.escrowBalance !== undefined) { sets.push(`"escrow_balance" = $${idx++}`); params.push(Number(data.escrowBalance)); }
      if (data.pendingWithdrawalBalance !== undefined) { sets.push(`"pending_withdrawal_balance" = $${idx++}`); params.push(Number(data.pendingWithdrawalBalance)); }
      if (data.withdrawnAmount !== undefined) { sets.push(`"withdrawn_amount" = $${idx++}`); params.push(Number(data.withdrawnAmount)); }
      sets.push(`"updated_at" = $${idx++}`); params.push(data.updatedAt || new Date());
      params.push(val);
      const res = await pool.query(
        `UPDATE "architect_wallets" SET ${sets.join(", ")} WHERE "${col}" = $${idx} RETURNING *`,
        params
      );
      return res.rows[0] ? mapArchitectWallet(res.rows[0]) : null;
    },
    async findMany() {
      const res = await pool.query(`SELECT * FROM "architect_wallets" ORDER BY "created_at" DESC`);
      return res.rows.map(mapArchitectWallet);
    },
  };
}

export function createWalletTransactionDelegate(pool: PgPool) {
  return {
    async create({ data }: any) {
      const id = data.id || ("wtx_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "wallet_transactions" (
          "id", "wallet_id", "vendor_id", "architect_id", "order_id", "design_id", "project_id", "escrow_id",
          "dispute_id", "withdrawal_id", "idempotency_key",
          "transaction_type", "amount", "fee", "net_amount", "currency", "status",
          "balance_before", "balance_after", "reference", "description", "metadata",
          "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
        [
          id,
          data.walletId,
          data.vendorId ?? null,
          data.architectId ?? null,
          data.orderId ?? null,
          data.designId ?? null,
          data.projectId ?? null,
          data.escrowId ?? null,
          data.disputeId ?? null,
          data.withdrawalId ?? null,
          data.idempotencyKey ?? null,
          data.transactionType,
          Number(data.amount ?? 0),
          Number(data.fee ?? 0),
          Number(data.netAmount ?? data.amount ?? 0),
          data.currency || "XAF",
          data.status || "COMPLETED",
          data.balanceBefore !== null && data.balanceBefore !== undefined ? Number(data.balanceBefore) : null,
          data.balanceAfter !== null && data.balanceAfter !== undefined ? Number(data.balanceAfter) : null,
          data.reference ?? null,
          data.description ?? null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapWalletTx(res.rows[0]);
    },
    async findMany(args: any = {}) {
      const { where = {}, take = 50, skip = 0 } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.vendorId) { conds.push(`"vendor_id" = $${idx++}`); params.push(where.vendorId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.walletId) { conds.push(`"wallet_id" = $${idx++}`); params.push(where.walletId); }
      if (where.orderId) { conds.push(`"order_id" = $${idx++}`); params.push(where.orderId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.escrowId) { conds.push(`"escrow_id" = $${idx++}`); params.push(where.escrowId); }
      if (where.transactionType) { conds.push(`"transaction_type" = $${idx++}`); params.push(where.transactionType); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(take, skip);
      const res = await pool.query(
        `SELECT * FROM "wallet_transactions" ${whereClause} ORDER BY "created_at" DESC LIMIT $${idx++} OFFSET $${idx++}`,
        params
      );
      return res.rows.map(mapWalletTx);
    },
    async count(args: any = {}) {
      const { where = {} } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.vendorId) { conds.push(`"vendor_id" = $${idx++}`); params.push(where.vendorId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.walletId) { conds.push(`"wallet_id" = $${idx++}`); params.push(where.walletId); }
      if (where.orderId) { conds.push(`"order_id" = $${idx++}`); params.push(where.orderId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.escrowId) { conds.push(`"escrow_id" = $${idx++}`); params.push(where.escrowId); }
      if (where.transactionType) { conds.push(`"transaction_type" = $${idx++}`); params.push(where.transactionType); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "wallet_transactions" ${whereClause}`, params);
      return res.rows[0]?.cnt ?? 0;
    },
    async findFirst(args: any = {}) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
  };
}

export function createEscrowTransactionDelegate(pool: PgPool) {
  return {
    async findFirst(args: any = {}) {
      const { where = {} } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.orderId) { conds.push(`"order_id" = $${idx++}`); params.push(where.orderId); }
      if (where.vendorId) { conds.push(`"vendor_id" = $${idx++}`); params.push(where.vendorId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.clientId) { conds.push(`"client_id" = $${idx++}`); params.push(where.clientId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.escrowType) { conds.push(`"escrow_type" = $${idx++}`); params.push(where.escrowType); }
      if (where.status) {
        if (typeof where.status === "object" && Array.isArray(where.status?.in)) {
          conds.push(`"status" = ANY($${idx++})`);
          params.push(where.status.in);
        } else {
          conds.push(`"status" = $${idx++}`);
          params.push(where.status);
        }
      }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`SELECT * FROM "escrow_transactions" ${whereClause} LIMIT 1`, params);
      return res.rows[0] ? mapEscrow(res.rows[0]) : null;
    },
    async findUnique(args: any) {
      return this.findFirst(args);
    },
    async findMany(args: any = {}) {
      const { where = {}, take, skip } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.orderId) { conds.push(`"order_id" = $${idx++}`); params.push(where.orderId); }
      if (where.vendorId) { conds.push(`"vendor_id" = $${idx++}`); params.push(where.vendorId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.clientId) { conds.push(`"client_id" = $${idx++}`); params.push(where.clientId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.escrowType) { conds.push(`"escrow_type" = $${idx++}`); params.push(where.escrowType); }
      if (where.status) {
        if (typeof where.status === "object" && Array.isArray(where.status?.in)) {
          conds.push(`"status" = ANY($${idx++})`);
          params.push(where.status.in);
        } else {
          conds.push(`"status" = $${idx++}`);
          params.push(where.status);
        }
      }
      if (where.confirmationDeadline && where.confirmationDeadline.lte) {
        conds.push(`"confirmation_deadline" <= $${idx++}`);
        params.push(where.confirmationDeadline.lte);
      }
      if (where.acceptanceDeadline && where.acceptanceDeadline.lte) {
        conds.push(`"acceptance_deadline" <= $${idx++}`);
        params.push(where.acceptanceDeadline.lte);
      }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      let limitOffset = "";
      if (take !== undefined) {
        limitOffset += ` LIMIT $${idx++}`;
        params.push(take);
      }
      if (skip !== undefined) {
        limitOffset += ` OFFSET $${idx++}`;
        params.push(skip);
      }
      const res = await pool.query(
        `SELECT * FROM "escrow_transactions" ${whereClause} ORDER BY "created_at" DESC ${limitOffset}`,
        params
      );
      return res.rows.map(mapEscrow);
    },
    async count(args: any = {}) {
      const { where = {} } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.orderId) { conds.push(`"order_id" = $${idx++}`); params.push(where.orderId); }
      if (where.vendorId) { conds.push(`"vendor_id" = $${idx++}`); params.push(where.vendorId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.clientId) { conds.push(`"client_id" = $${idx++}`); params.push(where.clientId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.escrowType) { conds.push(`"escrow_type" = $${idx++}`); params.push(where.escrowType); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "escrow_transactions" ${whereClause}`, params);
      return res.rows[0]?.cnt ?? 0;
    },
    async create({ data }: any) {
      const id = data.id || ("esc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "escrow_transactions" (
          "id", "escrow_type", "order_id", "wallet_id", "vendor_id", "architect_id", "client_id", "project_id", "design_id", "milestone_id", "payment_id",
          "amount", "platform_fee", "gross_amount", "currency", "status", "revision_count", "max_revisions",
          "funded_at", "delivered_at", "unlocked_at", "confirmation_deadline", "acceptance_deadline", "released_at",
          "refunded_at", "disputed_at", "release_reason", "content_hash", "auto_release_eligible", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) RETURNING *`,
        [
          id,
          data.escrowType || "VENDOR",
          data.orderId ?? null,
          data.walletId,
          data.vendorId ?? null,
          data.architectId ?? null,
          data.clientId,
          data.projectId ?? null,
          data.designId ?? null,
          data.milestoneId ?? null,
          data.paymentId ?? null,
          Number(data.amount ?? 0),
          Number(data.platformFee ?? 0),
          Number(data.grossAmount ?? data.amount ?? 0),
          data.currency || "XAF",
          data.status || "ESCROWED",
          Number(data.revisionCount ?? 0),
          Number(data.maxRevisions ?? 2),
          data.fundedAt ?? now,
          data.deliveredAt ?? null,
          data.unlockedAt ?? null,
          data.confirmationDeadline ?? null,
          data.acceptanceDeadline ?? null,
          data.releasedAt ?? null,
          data.refundedAt ?? null,
          data.disputedAt ?? null,
          data.releaseReason ?? null,
          data.contentHash ?? null,
          data.autoReleaseEligible ?? true,
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapEscrow(res.rows[0]);
    },
    async update({ where, data }: any) {
      const col = where.orderId !== undefined ? "order_id" : (where.id !== undefined ? "id" : (where.designId !== undefined ? "design_id" : "id"));
      const val = where[col === "order_id" ? "orderId" : (col === "design_id" ? "designId" : "id")];
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.status !== undefined) { sets.push(`"status" = $${idx++}`); params.push(data.status); }
      if (data.deliveredAt !== undefined) { sets.push(`"delivered_at" = $${idx++}`); params.push(data.deliveredAt); }
      if (data.unlockedAt !== undefined) { sets.push(`"unlocked_at" = $${idx++}`); params.push(data.unlockedAt); }
      if (data.confirmationDeadline !== undefined) { sets.push(`"confirmation_deadline" = $${idx++}`); params.push(data.confirmationDeadline); }
      if (data.acceptanceDeadline !== undefined) { sets.push(`"acceptance_deadline" = $${idx++}`); params.push(data.acceptanceDeadline); }
      if (data.revisionCount !== undefined) { sets.push(`"revision_count" = $${idx++}`); params.push(Number(data.revisionCount)); }
      if (data.releasedAt !== undefined) { sets.push(`"released_at" = $${idx++}`); params.push(data.releasedAt); }
      if (data.refundedAt !== undefined) { sets.push(`"refunded_at" = $${idx++}`); params.push(data.refundedAt); }
      if (data.disputedAt !== undefined) { sets.push(`"disputed_at" = $${idx++}`); params.push(data.disputedAt); }
      if (data.releaseReason !== undefined) { sets.push(`"release_reason" = $${idx++}`); params.push(data.releaseReason); }
      if (data.contentHash !== undefined) { sets.push(`"content_hash" = $${idx++}`); params.push(data.contentHash); }
      if (data.autoReleaseEligible !== undefined) { sets.push(`"auto_release_eligible" = $${idx++}`); params.push(data.autoReleaseEligible); }
      sets.push(`"updated_at" = $${idx++}`); params.push(data.updatedAt || new Date());
      params.push(val);
      const res = await pool.query(
        `UPDATE "escrow_transactions" SET ${sets.join(", ")} WHERE "${col}" = $${idx} RETURNING *`,
        params
      );
      return res.rows[0] ? mapEscrow(res.rows[0]) : null;
    },
  };
}

export function createDesignRevisionDelegate(pool: PgPool) {
  return {
    async create({ data }: any) {
      const id = data.id || ("rev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "design_revisions" (
          "id", "escrow_id", "design_id", "project_id", "client_id", "architect_id",
          "revision_number", "client_request", "architect_response", "status", "attachments",
          "submitted_at", "reviewed_at", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [
          id,
          data.escrowId,
          data.designId,
          data.projectId ?? null,
          data.clientId,
          data.architectId,
          Number(data.revisionNumber ?? 1),
          data.clientRequest,
          data.architectResponse ?? null,
          data.status || "REQUESTED",
          data.attachments ? JSON.stringify(data.attachments) : null,
          data.submittedAt ?? null,
          data.reviewedAt ?? null,
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapDesignRevision(res.rows[0]);
    },
    async findMany(args: any = {}) {
      const { where = {}, take = 50, skip = 0 } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.escrowId) { conds.push(`"escrow_id" = $${idx++}`); params.push(where.escrowId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.clientId) { conds.push(`"client_id" = $${idx++}`); params.push(where.clientId); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      params.push(take, skip);
      const res = await pool.query(
        `SELECT * FROM "design_revisions" ${whereClause} ORDER BY "revision_number" ASC LIMIT $${idx++} OFFSET $${idx++}`,
        params
      );
      return res.rows.map(mapDesignRevision);
    },
    async findFirst(args: any = {}) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
    async findUnique(args: any = {}) {
      return this.findFirst(args);
    },
    async count(args: any = {}) {
      const { where = {} } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.escrowId) { conds.push(`"escrow_id" = $${idx++}`); params.push(where.escrowId); }
      if (where.designId) { conds.push(`"design_id" = $${idx++}`); params.push(where.designId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "design_revisions" ${whereClause}`, params);
      return res.rows[0]?.cnt ?? 0;
    },
    async update({ where, data }: any) {
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.status !== undefined) { sets.push(`"status" = $${idx++}`); params.push(data.status); }
      if (data.architectResponse !== undefined) { sets.push(`"architect_response" = $${idx++}`); params.push(data.architectResponse); }
      if (data.attachments !== undefined) { sets.push(`"attachments" = $${idx++}`); params.push(JSON.stringify(data.attachments)); }
      if (data.submittedAt !== undefined) { sets.push(`"submitted_at" = $${idx++}`); params.push(data.submittedAt); }
      if (data.reviewedAt !== undefined) { sets.push(`"reviewed_at" = $${idx++}`); params.push(data.reviewedAt); }
      sets.push(`"updated_at" = $${idx++}`); params.push(data.updatedAt || new Date());
      params.push(where.id);
      const res = await pool.query(
        `UPDATE "design_revisions" SET ${sets.join(", ")} WHERE "id" = $${idx} RETURNING *`,
        params
      );
      return res.rows[0] ? mapDesignRevision(res.rows[0]) : null;
    }
  };
}

function mapRoomagenJob(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    architectId: row.architect_id,
    roomagenJobId: row.roomagen_job_id,
    tool: row.tool,
    status: row.status,
    inputAssetUrl: row.input_asset_url,
    outputAssetUrl: row.output_asset_url,
    inputAssetId: row.input_asset_id,
    outputAssetId: row.output_asset_id,
    version: row.version ?? 1,
    prompt: row.prompt,
    options: typeof row.options === "string" ? JSON.parse(row.options) : row.options,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
    errorMessage: row.error_message,
    provider: row.provider ?? "roomagen",
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    failedAt: row.failed_at ? new Date(row.failed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createRoomagenJobDelegate(pool: PgPool) {
  return {
    async create({ data }: any) {
      const id = data.id || ("rj_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
      const now = new Date();
      const res = await pool.query(
        `INSERT INTO "roomagen_jobs" (
          "id", "project_id", "user_id", "architect_id", "roomagen_job_id",
          "tool", "status", "input_asset_url", "output_asset_url", "input_asset_id",
          "output_asset_id", "version", "prompt", "options", "metadata",
          "error_message", "provider", "completed_at", "failed_at", "created_at", "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
        [
          id,
          data.projectId ?? null,
          data.userId,
          data.architectId ?? null,
          data.roomagenJobId ?? null,
          data.tool,
          data.status || "PENDING",
          data.inputAssetUrl ?? null,
          data.outputAssetUrl ?? null,
          data.inputAssetId ?? null,
          data.outputAssetId ?? null,
          Number(data.version ?? 1),
          data.prompt ?? null,
          data.options ? JSON.stringify(data.options) : null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.errorMessage ?? null,
          data.provider || "roomagen",
          data.completedAt ?? null,
          data.failedAt ?? null,
          data.createdAt || now,
          data.updatedAt || now,
        ]
      );
      return mapRoomagenJob(res.rows[0]);
    },
    async findMany(args: any = {}) {
      const { where = {}, take = 100, skip = 0, orderBy } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.userId) { conds.push(`"user_id" = $${idx++}`); params.push(where.userId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.roomagenJobId) { conds.push(`"roomagen_job_id" = $${idx++}`); params.push(where.roomagenJobId); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      if (where.tool) { conds.push(`"tool" = $${idx++}`); params.push(where.tool); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      let orderClause = `ORDER BY "created_at" DESC`;
      if (orderBy?.createdAt === "asc") orderClause = `ORDER BY "created_at" ASC`;
      params.push(take, skip);
      const res = await pool.query(
        `SELECT * FROM "roomagen_jobs" ${whereClause} ${orderClause} LIMIT $${idx++} OFFSET $${idx++}`,
        params
      );
      return res.rows.map(mapRoomagenJob);
    },
    async findFirst(args: any = {}) {
      const rows = await this.findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
    async findUnique(args: any = {}) {
      return this.findFirst(args);
    },
    async count(args: any = {}) {
      const { where = {} } = args;
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.userId) { conds.push(`"user_id" = $${idx++}`); params.push(where.userId); }
      if (where.architectId) { conds.push(`"architect_id" = $${idx++}`); params.push(where.architectId); }
      if (where.roomagenJobId) { conds.push(`"roomagen_job_id" = $${idx++}`); params.push(where.roomagenJobId); }
      if (where.status) { conds.push(`"status" = $${idx++}`); params.push(where.status); }
      if (where.tool) { conds.push(`"tool" = $${idx++}`); params.push(where.tool); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "roomagen_jobs" ${whereClause}`, params);
      return res.rows[0]?.cnt ?? 0;
    },
    async update({ where, data }: any) {
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (data.status !== undefined) { sets.push(`"status" = $${idx++}`); params.push(data.status); }
      if (data.roomagenJobId !== undefined) { sets.push(`"roomagen_job_id" = $${idx++}`); params.push(data.roomagenJobId); }
      if (data.outputAssetUrl !== undefined) { sets.push(`"output_asset_url" = $${idx++}`); params.push(data.outputAssetUrl); }
      if (data.outputAssetId !== undefined) { sets.push(`"output_asset_id" = $${idx++}`); params.push(data.outputAssetId); }
      if (data.inputAssetUrl !== undefined) { sets.push(`"input_asset_url" = $${idx++}`); params.push(data.inputAssetUrl); }
      if (data.inputAssetId !== undefined) { sets.push(`"input_asset_id" = $${idx++}`); params.push(data.inputAssetId); }
      if (data.version !== undefined) { sets.push(`"version" = $${idx++}`); params.push(Number(data.version)); }
      if (data.prompt !== undefined) { sets.push(`"prompt" = $${idx++}`); params.push(data.prompt); }
      if (data.options !== undefined) { sets.push(`"options" = $${idx++}`); params.push(data.options ? JSON.stringify(data.options) : null); }
      if (data.metadata !== undefined) { sets.push(`"metadata" = $${idx++}`); params.push(data.metadata ? JSON.stringify(data.metadata) : null); }
      if (data.errorMessage !== undefined) { sets.push(`"error_message" = $${idx++}`); params.push(data.errorMessage); }
      if (data.completedAt !== undefined) { sets.push(`"completed_at" = $${idx++}`); params.push(data.completedAt); }
      if (data.failedAt !== undefined) { sets.push(`"failed_at" = $${idx++}`); params.push(data.failedAt); }
      sets.push(`"updated_at" = $${idx++}`); params.push(data.updatedAt || new Date());

      let whereClause = "";
      if (where.id) {
        whereClause = `"id" = $${idx}`;
        params.push(where.id);
      } else if (where.roomagenJobId) {
        whereClause = `"roomagen_job_id" = $${idx}`;
        params.push(where.roomagenJobId);
      } else {
        throw new Error("Missing where.id or where.roomagenJobId in roomagenJob.update");
      }

      const res = await pool.query(
        `UPDATE "roomagen_jobs" SET ${sets.join(", ")} WHERE ${whereClause} RETURNING *`,
        params
      );
      return res.rows[0] ? mapRoomagenJob(res.rows[0]) : null;
    },
    async delete({ where }: any) {
      if (!where.id) return false;
      const res = await pool.query(`DELETE FROM "roomagen_jobs" WHERE "id" = $1`, [where.id]);
      return (res.rowCount ?? 0) > 0;
    },
    async deleteMany({ where = {} }: any) {
      const conds: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (where.id) { conds.push(`"id" = $${idx++}`); params.push(where.id); }
      if (where.projectId) { conds.push(`"project_id" = $${idx++}`); params.push(where.projectId); }
      if (where.userId) { conds.push(`"user_id" = $${idx++}`); params.push(where.userId); }
      const whereClause = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
      const res = await pool.query(`DELETE FROM "roomagen_jobs" ${whereClause}`, params);
      return { count: res.rowCount ?? 0 };
    }
  };
}

export function attachWalletDelegates(target: any) {
  if (!target) return;
  const pool = getPgPool();
  if (!target.vendorWallet) {
    target.vendorWallet = createVendorWalletDelegate(pool);
  }
  if (!target.architectWallet) {
    target.architectWallet = createArchitectWalletDelegate(pool);
  }
  if (!target.walletTransaction) {
    target.walletTransaction = createWalletTransactionDelegate(pool);
  }
  if (!target.escrowTransaction) {
    target.escrowTransaction = createEscrowTransactionDelegate(pool);
  }
  if (!target.designRevision) {
    target.designRevision = createDesignRevisionDelegate(pool);
  }
  if (!target.roomagenJob) {
    target.roomagenJob = createRoomagenJobDelegate(pool);
  }
}

function wrapPrismaTransactions(prisma: any) {
  if (!prisma || prisma.__wrappedTransactions) return;
  prisma.__wrappedTransactions = true;
  const origTransaction = prisma.$transaction?.bind(prisma);
  if (typeof origTransaction === "function") {
    prisma.$transaction = async function (arg: any, ...rest: any[]) {
      if (typeof arg === "function") {
        return origTransaction(async (tx: any) => {
          attachWalletDelegates(tx);
          return arg(tx);
        }, ...rest);
      }
      return origTransaction(arg, ...rest);
    };
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
async function connect(): Promise<PrismaClient> {
  if (g.__buildsmartPrisma) {
    try {
      const existing = await g.__buildsmartPrisma;
      attachWalletDelegates(existing);
      wrapPrismaTransactions(existing);
      return existing;
    } catch {
      g.__buildsmartPrisma = undefined;
    }
  }

  g.__buildsmartPrisma = (async () => {
    // Shared pg.Pool for the Prisma pg driver adapter + direct SQL helpers.
    const pool = getPgPool();

    // Create tables only on a completely fresh database, then create the AI
    // telemetry tables idempotently. Nothing here drops or alters data.
    await ensureDatabaseSchema(pool);

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    attachWalletDelegates(prisma);
    wrapPrismaTransactions(prisma);
    await seedIfEmpty(prisma);
    await ensureBlogPosts(prisma);
    return prisma;
  })().catch((err) => {
    g.__buildsmartPrisma = undefined;
    throw err;
  });

  return g.__buildsmartPrisma;
}

function newId() {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// Columns the app treats as booleans but sometimes passes as 0/1.
const BOOL_COLS = new Set(["emailVerified", "isActive", "read", "active", "backorderable", "isDefault", "archived", "aiGenerated", "isSystem"]);

// Timestamp columns (Prisma DateTime columns, converted from ISO/string values).
const DATE_COLS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "renewsAt",
  "verifiedAt",
  "joinedAt",
  "shippedAt",
  "fulfilledAt",
  "respondedAt",
  "requestedAt",
  "resolvedAt",
  "processedAt",
  "endsAt",
  "deadline",
  "publishedAt",
  "dueAt",
  "lastActiveAt",
  "scheduledAt",
  "expiresAt",
  "completedAt",
  "failedAt",
]);

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  return v === 1 || v === "1" || v === "true" || v === "TRUE" || v === "t" || v === "yes" || v === "on";
}

function toDate(v: any): any {
  if (v === null || v === undefined || v instanceof Date) return v;
  return new Date(v);
}

function normalize(data: Any | undefined): Any {
  if (!data) return {};
  const out: Any = { ...data };
  for (const k of BOOL_COLS) {
    if (k in out && typeof out[k] !== "boolean") out[k] = toBool(out[k]);
  }
  for (const k of DATE_COLS) {
    if (k in out && out[k] !== null && out[k] !== undefined) out[k] = toDate(out[k]);
  }
  return out;
}

function withId(data: Any): Any {
  const normalized = normalize(data);
  return { ...normalized, id: normalized.id ?? newId() };
}

function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
const MODEL_KEYS = [
  "user", "userProfile", "architectProfile", "vendorProfile", "product", "project",
  "floorPlan", "cart", "cartItem", "chatRoom", "chatParticipant", "message", "order",
  "orderItem", "notification", "review", "blogPost", "supportTicket", "subscription",
  "payment", "document", "productMedia", "warehouse", "warehouseStock", "coupon",
  "campaign", "crossSell", "returnRequest", "withdrawal", "inquiry", "vendorTraffic",
  "designRequest", "design", "appointment", "boq", "boqItem", "transaction", "activity",
  "floorPlanFeedback", "favorite", "invoice", "auditLog", "securityEvent", "report",
  "dispute", "announcement", "faq", "platformSetting", "adminRole", "aiConversation",
  "aiMessage", "aiFeedback", "aiToolExecution", "aiUsageLog",
  "vendorWallet", "architectWallet", "walletTransaction", "escrowTransaction", "designRevision",
  "roomagenJob",
];

const ORDER_BY: Record<string, any> = {
  user: { createdAt: "asc" },
  userProfile: { id: "asc" },
  architectProfile: { id: "asc" },
  vendorProfile: { id: "asc" },
  product: { createdAt: "asc" },
  project: { createdAt: "asc" },
  floorPlan: [{ version: "asc" }, { createdAt: "asc" }],
  cartItem: { createdAt: "asc" },
  chatRoom: { createdAt: "asc" },
  chatParticipant: { joinedAt: "asc" },
  message: { createdAt: "asc" },
  order: { createdAt: "desc" },
  orderItem: { id: "asc" },
  notification: { createdAt: "desc" },
  review: { createdAt: "desc" },
  blogPost: { createdAt: "desc" },
  supportTicket: { createdAt: "desc" },
  subscription: { startedAt: "asc" },
  payment: { createdAt: "desc" },
  document: { createdAt: "desc" },
  productMedia: [{ position: "asc" }, { createdAt: "asc" }],
  warehouse: { createdAt: "asc" },
  coupon: { createdAt: "desc" },
  campaign: { createdAt: "desc" },
  returnRequest: { requestedAt: "desc" },
  withdrawal: { requestedAt: "desc" },
  inquiry: { updatedAt: "desc" },
  vendorTraffic: { day: "asc" },
  designRequest: { createdAt: "desc" },
  design: { updatedAt: "desc" },
  appointment: [{ date: "asc" }, { startTime: "asc" }],
  boq: { updatedAt: "desc" },
  boqItem: { createdAt: "asc" },
  transaction: { createdAt: "desc" },
  activity: { createdAt: "desc" },
  floorPlanFeedback: { createdAt: "desc" },
  favorite: { createdAt: "desc" },
  invoice: { createdAt: "desc" },
  auditLog: { createdAt: "desc" },
  securityEvent: { createdAt: "desc" },
  report: { createdAt: "desc" },
  dispute: { createdAt: "desc" },
  announcement: { createdAt: "desc" },
  faq: [{ position: "asc" }, { createdAt: "asc" }],
  platformSetting: { key: "asc" },
  adminRole: { name: "asc" },
  aiConversation: { updatedAt: "desc" },
  aiMessage: { createdAt: "asc" },
  aiFeedback: { createdAt: "desc" },
  aiToolExecution: { createdAt: "desc" },
  aiUsageLog: { createdAt: "desc" },
  vendorWallet: { createdAt: "desc" },
  architectWallet: { createdAt: "desc" },
  walletTransaction: { createdAt: "desc" },
  escrowTransaction: { createdAt: "desc" },
  designRevision: { revisionNumber: "asc" },
  roomagenJob: { createdAt: "desc" },
};

const CREATED_AT_MODELS = new Set([
  "user", "product", "project", "floorPlan", "cart", "cartItem",
  "chatRoom", "message", "order", "notification", "review", "blogPost",
  "supportTicket", "payment", "document", "productMedia", "warehouse", "coupon",
  "campaign", "crossSell", "inquiry", "designRequest", "design", "appointment",
  "boq", "boqItem", "transaction", "activity", "floorPlanFeedback", "favorite",
  "invoice", "auditLog", "securityEvent", "report", "dispute", "announcement",
  "faq", "adminRole", "aiConversation", "aiMessage", "aiFeedback", "aiToolExecution",
  "aiUsageLog", "vendorWallet", "architectWallet", "walletTransaction", "escrowTransaction", "designRevision",
  "roomagenJob",
]);

const UPDATED_AT_MODELS = new Set([
  "project", "floorPlan", "supportTicket", "inquiry", "designRequest", "design",
  "boq", "floorPlanFeedback", "report", "dispute", "platformSetting", "aiConversation",
  "vendorWallet", "architectWallet", "walletTransaction", "escrowTransaction", "designRevision",
  "roomagenJob",
]);

function prepareForCreate(key: string, data: Any): Any {
  const row = withId(data);
  const now = new Date();
  if (CREATED_AT_MODELS.has(key) && row.createdAt === undefined) {
    row.createdAt = now;
  }
  if (UPDATED_AT_MODELS.has(key) && row.updatedAt === undefined) {
    row.updatedAt = now;
  }
  if (key === "chatParticipant" && row.joinedAt === undefined) {
    row.joinedAt = now;
  }
  if ((key === "returnRequest" || key === "withdrawal") && row.requestedAt === undefined) {
    row.requestedAt = now;
  }
  if (key === "review" && !row.status) {
    row.status = "PENDING";
  }
  if (key === "supportTicket" || key === "inquiry") {
    row.status = row.status ?? "OPEN";
    row.messages = row.messages ?? [];
  }
  return row;
}

async function delegateFor(key: string) {
  const prisma = await connect();
  let delegate = (prisma as any)[key];
  if (!delegate && (key === "vendorWallet" || key === "architectWallet" || key === "walletTransaction" || key === "escrowTransaction" || key === "designRevision" || key === "roomagenJob")) {
    attachWalletDelegates(prisma);
    delegate = (prisma as any)[key];
  }
  return {
    prisma,
    delegate,
  };
}

function makeModel(key: string) {
  return {
    async findMany({ where }: any = {}) {
      const { delegate } = await delegateFor(key);
      const args: any = { where: where ?? {} };
      if (ORDER_BY[key]) args.orderBy = ORDER_BY[key];
      return delegate.findMany(args);
    },
    async findUnique({ where }: any) {
      const { delegate } = await delegateFor(key);
      try {
        return await delegate.findUnique({ where });
      } catch {
        // Some legacy findUnique calls used non-unique columns; fall back to
        // findFirst so those callers keep working unchanged.
        return (await delegate.findFirst({ where })) ?? null;
      }
    },
    async findFirst({ where }: any) {
      const { delegate } = await delegateFor(key);
      return (await delegate.findFirst({ where })) ?? null;
    },
    async create({ data }: any) {
      const { delegate } = await delegateFor(key);
      const row = prepareForCreate(key, data);
      try {
        return await delegate.create({ data: row });
      } catch (err: any) {
        if (key === 'order' && /escrowStatus|confirmationDeadline/i.test(err?.message ?? '')) {
          const { escrowStatus, confirmationDeadline, ...safeRow } = row;
          const created = await delegate.create({ data: safeRow });
          const pool = getPgPool();
          await pool.query(
            `UPDATE "orders" SET "escrow_status" = $1, "confirmation_deadline" = $2 WHERE "id" = $3`,
            [escrowStatus ?? 'ESCROWED', confirmationDeadline ?? null, created.id]
          ).catch(() => {});
          return { ...created, escrowStatus: escrowStatus ?? 'ESCROWED', confirmationDeadline };
        }
        throw err;
      }
    },
    async createMany({ data }: any) {
      const { delegate } = await delegateFor(key);
      const rows = (data as any[]).map((d) => prepareForCreate(key, d));
      if (rows.length) await delegate.createMany({ data: rows });
      return { count: rows.length };
    },
    async update({ where, data }: any) {
      const { delegate } = await delegateFor(key);
      let set = normalize(data);
      if (UPDATED_AT_MODELS.has(key)) set = { ...set, updatedAt: set.updatedAt ?? new Date() };
      let effectiveWhere = where;
      if (where && !where.id) {
        try {
          return await delegate.update({ where, data: set });
        } catch (e: any) {
          if (isNotFound(e)) return null;
          const found = await delegate.findFirst({ where }).catch(() => null);
          if (!found) return null;
          effectiveWhere = { id: found.id };
        }
      }
      try {
        return await delegate.update({ where: effectiveWhere, data: set });
      } catch (e: any) {
        if (isNotFound(e)) return null;
        if (key === 'order' && /escrowStatus|confirmationDeadline/i.test(e?.message ?? '')) {
          const { escrowStatus, confirmationDeadline, ...safeSet } = set;
          const updated = Object.keys(safeSet).length > 0
            ? await delegate.update({ where: effectiveWhere, data: safeSet })
            : await delegate.findUnique({ where: effectiveWhere });
          const pool = getPgPool();
          const targetId = effectiveWhere.id ?? where?.id;
          if (escrowStatus !== undefined && confirmationDeadline !== undefined) {
            await pool.query(
              `UPDATE "orders" SET "escrow_status" = $1, "confirmation_deadline" = $2 WHERE "id" = $3`,
              [escrowStatus, confirmationDeadline, targetId]
            ).catch(() => {});
          } else if (escrowStatus !== undefined) {
            await pool.query(
              `UPDATE "orders" SET "escrow_status" = $1 WHERE "id" = $2`,
              [escrowStatus, targetId]
            ).catch(() => {});
          } else if (confirmationDeadline !== undefined) {
            await pool.query(
              `UPDATE "orders" SET "confirmation_deadline" = $1 WHERE "id" = $2`,
              [confirmationDeadline, targetId]
            ).catch(() => {});
          }
          return { ...updated, escrowStatus, confirmationDeadline };
        }
        throw e;
      }
    },
    async updateMany({ where, data }: any) {
      const { delegate } = await delegateFor(key);
      try {
        return await delegate.updateMany({ where, data: normalize(data) });
      } catch (e) {
        if (isNotFound(e)) return { count: 0 };
        throw e;
      }
    },
    async delete({ where }: any) {
      const { delegate } = await delegateFor(key);
      let effectiveWhere = where;
      if (where && !where.id) {
        try {
          await delegate.delete({ where });
          return true;
        } catch (e: any) {
          if (isNotFound(e)) return false;
          const found = await delegate.findFirst({ where }).catch(() => null);
          if (!found) return false;
          effectiveWhere = { id: found.id };
        }
      }
      try {
        await delegate.delete({ where: effectiveWhere });
        return true;
      } catch (e) {
        if (isNotFound(e)) return false;
        throw e;
      }
    },
    async deleteMany({ where }: any = {}) {
      const { delegate } = await delegateFor(key);
      const res = await delegate.deleteMany({ where: where ?? {} });
      return { count: res?.count ?? 0 };
    },
    async deleteWhere({ where }: any) {
      const { delegate } = await delegateFor(key);
      return delegate.deleteMany({ where });
    },
    async count({ where }: any = {}) {
      const { delegate } = await delegateFor(key);
      return delegate.count({ where: where ?? {} });
    },
  };
}

type ModelQuery = (...args: any[]) => Promise<any[]>;
type ModelMethod = (...args: any[]) => Promise<any>;
type ModelApi = {
  findMany: ModelQuery;
  findUnique: ModelMethod;
  findFirst: ModelMethod;
  create: ModelMethod;
  createMany: (...args: any[]) => Promise<{ count: number }>;
  update: ModelMethod;
  updateMany: (...args: any[]) => Promise<{ count: number }>;
  delete: ModelMethod;
  deleteMany: (...args: any[]) => Promise<{ count: number }>;
  deleteWhere: (...args: any[]) => Promise<{ count: number }>;
  upsert: ModelMethod;
  countForWindow: ModelMethod;
  count: ModelMethod;
};

function buildDbClient(): Record<string, ModelApi> {
  const client: Any = {};
  for (const key of MODEL_KEYS) client[key] = makeModel(key);

  // Specialized methods that need extra logic beyond the generic CRUD shape.

  client.cartItem.findMany = async ({ where }: any = {}) => {
    const { prisma } = await delegateFor("cartItem");
    const items = await prisma.cartItem.findMany({ where: where ?? {}, orderBy: ORDER_BY.cartItem });
    const productIds = [...new Set(items.map((i: any) => i.productId))];
    let productMap: Record<string, any> = {};
    if (productIds.length) {
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
      productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
    }
    return items.map((i: any) => {
      const product = productMap[i.productId] || {};
      const cat = (product.category || "").toLowerCase();
      const pName = (product.name || "").toLowerCase();
      let fallbackImg = "/images/product-cement.png";
      if (cat.includes("steel") || pName.includes("rebar") || pName.includes("steel")) fallbackImg = "/images/product-rebar.png";
      else if (cat.includes("tile") || pName.includes("tile")) fallbackImg = "/images/product-tiles.png";
      else if (cat.includes("roof") || pName.includes("roof")) fallbackImg = "/images/product-roofing.png";
      else if (pName.includes("beam")) fallbackImg = "/images/product-steel-beam.png";
      else if (pName.includes("angle")) fallbackImg = "/images/product-angle-iron.png";

      return {
        ...i,
        name: product.name,
        price: product.price,
        unit: product.unit,
        category: product.category,
        vendorId: product.vendorId,
        imageUrl: product.imageUrl || fallbackImg,
        description: product.description,
      };
    });
  };

  client.vendorTraffic.upsert = async ({ data }: any) => {
    const { prisma } = await delegateFor("vendorTraffic");
    const existing = await prisma.vendorTraffic.findFirst({
      where: { vendorId: data.vendorId, day: data.day, source: data.source },
    });
    if (existing) {
      return (prisma as any).vendorTraffic.update({
        where: { id: existing.id },
        data: { visits: (existing.visits || 0) + (data.visits || 0) },
      });
    }
    return (prisma as any).vendorTraffic.create({ data: withId(data) });
  };

  client.platformSetting.upsert = async ({ data }: any) => {
    const { prisma } = await delegateFor("platformSetting");
    const existing = await prisma.platformSetting.findUnique({ where: { key: data.key } });
    if (existing) {
      return (prisma as any).platformSetting.update({
        where: { id: existing.id },
        data: { value: data.value, updatedAt: new Date() },
      });
    }
    return (prisma as any).platformSetting.create({
      data: { id: withId(data).id, key: data.key, value: data.value, updatedAt: new Date() },
    });
  };

  client.aiUsageLog.countForWindow = async ({ userId, since }: any) => {
    const { prisma } = await delegateFor("aiUsageLog");
    return prisma.aiUsageLog.count({ where: { userId, createdAt: { gte: since } } });
  };

  return client;
}

// ---------------------------------------------------------------------------
// Public API (same shape as the former in-memory / Drizzle-backed store)
// ---------------------------------------------------------------------------
export const dbClient: Record<string, ModelApi> = buildDbClient();

// Less-common code can still get the raw client when needed.
export async function getPrisma(): Promise<PrismaClient> {
  return connect();
}

// Ensure the demo rows exist without touching non-empty databases.
export async function ensureSeeded(): Promise<void> {
  const prisma = await connect();
  await seedIfEmpty(prisma);
}

// Ordered list of models for `npm run db:seed -- --reset`. The original schema
// is foreign-key free, so deleting rows in this order is safe on a test datadir.
export const SEED_MODEL_KEYS = [
  ...MODEL_KEYS.filter((key) => key !== "aiUsageLog"),
];

// Delete every row and reseed. Used by `npm run db:seed -- --reset` when a
// developer explicitly asks to rebuild demo data. Never runs automatically.
export async function resetAndSeed(): Promise<void> {
  const prisma = await connect();
  await prisma.$transaction(
    SEED_MODEL_KEYS.map((key) => (prisma as any)[key].deleteMany({ where: {} })),
  );
  await seedIfEmpty(prisma);
}
