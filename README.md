# BuildSmart AI

**Professional AI-powered platform for Architecture, Engineering & Construction (AEC)**

Design smarter. Build better.

## Current Status (2026-08-30)

**Real backend implemented, tested, and working.**

### ✅ Completed
- Full repository audit + all specification modules read
- Stitch AI approved UI interfaces extracted + design system implemented
- Next.js 16 + TypeScript + Tailwind + modern stack
- Professional **BuildSmart AI Design System** (architectural green, 8px grid, Inter typography)
- Secure Authentication (NextAuth Credentials + bcrypt + Zod validation) — currently in preview mode (disabled) per request
- Role-based registration (Client / Architect / Vendor)
- Production-quality landing page + role dashboards (admin, client, architect, vendor)
- Marketplace, cart, orders, projects, documents, floor plans, reviews, support tickets, subscriptions, payments, blog, search, analytics
- **Persistent database**: PostgreSQL via Prisma ORM + node-postgres driver adapter — schema bootstrap + seed, survives restarts and is shared by all app instances
- **Real-time chat**: Server-Sent Events (`/api/chat/events`) with polling fallback
- Full test coverage: type-check, data-layer smoke suite, production build, page/API smoke all clean

### 🚧 Next (optional, needs external keys)
- Real AI generation (OpenAI / Anthropic API keys)
- Real payment processing (Stripe secret/webhook keys)
- File storage (S3-compatible keys)
- Re-enable authentication redirects (see `Frontend/proxy.ts` comment)

### Stack (per specification)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind
- **Auth**: NextAuth v5 + Credentials
- **Backend**: Next.js Route Handlers + API layer
- **Database**: PostgreSQL + Prisma ORM via the node-postgres (`pg`) driver adapter
- **Real-time**: Server-Sent Events + polling fallback
- **3D**: Three.js + React Three Fiber + Drei
- **2D**: SVG (floor plans)
- **Design Language**: Architectural Green (#315C4C) + Warm White + Slate

## Quick Start

```bash
# 1. Install
npm install
# New PostgreSQL packages (already in package.json):
#   @prisma/adapter-pg, pg          — Prisma + PostgreSQL driver adapters
#   @electric-sql/pglite (dev)      — only used by the PGlite import script

# 2. Setup frontend env
cp Frontend/.env.example Frontend/.env.local
# Set DATABASE_URL in Frontend/.env.local, for example:
#   DATABASE_URL=postgresql://postgres:12345678@localhost:5432/build

# 3. Seed / bootstrap the database (safe on an existing database)
npm run db:seed

# 4. Run (Next.js project root is Frontend/)
npm run dev
```

Visit http://localhost:3000

Default flows:
- Register (choose Client / Architect / Vendor)
- Login
- Dashboard (role-aware quick links)
- Marketplace (cart + checkout against the real database)
- Project chat (real-time via SSE)

## Repository layout

- `Frontend/` — Next.js frontend project: `app/` (pages, layouts, route handlers),
  `components/`, `public/`, `next.config.ts`, `proxy.ts`, and `tsconfig.json`
- `Backend/` — server-side code: `lib/` (db, auth, Gemini, Copilot),
  `actions/`, `prisma/`, `scripts/`, `docs/`

## Data layer

- `Backend/prisma/schema.prisma` — Prisma schema (54 models mirroring the existing tables)
- `Backend/prisma/legacy-migrations/` — original SQL migrations, applied only when the database is brand new
- `Backend/lib/db.ts` — Prisma + node-postgres adapter and the `dbClient` API (drop-in for every API route)
- `Backend/lib/pg-setup.ts` — connection URL/pool setup and idempotent PostgreSQL bootstrap
- `Backend/lib/seed.ts` — idempotent seed (`npm run db:seed`; safe to run on an existing database)
- `Backend/scripts/db-smoke.ts` — data-layer smoke test (`npm run db:smoke`)

## Migrating existing PGlite data to PostgreSQL

If you previously ran BuildSmart with PGlite and your old data lives in the
repo-local `.buildsmart-pgdata` directory, import that data into PostgreSQL
without deleting anything:

```bash
# Set DATABASE_URL in Frontend/.env.local first.
npm run db:migrate-pglite
```

The import reads every user table from PGlite and inserts it into PostgreSQL
with `ON CONFLICT DO NOTHING`, so existing PostgreSQL rows are preserved and
nothing is deleted. To point at a PGlite directory other than the default:

```bash
PGLITE_DIR=/path/to/.buildsmart-pgdata npm run db:migrate-pglite
```

After a successful import, run the app normally (`npm run dev`). The app will
use the local PostgreSQL server; PGlite is no longer used at runtime.

## Security & Engineering Principles
- Server-side authorization enforced
- Never trust client input
- Passwords hashed with bcrypt (12 rounds)
- Prisma ORM (typed, parameterized access) for all DB access
- Clean separation: UI → API → data layer
- OWASP-aligned patterns

## Documentation
- `Backend/docs/00-MODULE-INDEX.md`
- All `XX-*.md` functional specifications in `Backend/docs/`
- `Frontend/stitch-ui/` contains original approved Stitch designs

This is a production-quality foundation — not a prototype.
