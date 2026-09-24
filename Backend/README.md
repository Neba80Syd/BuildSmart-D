# BuildSmart AI — Backend

This directory contains the **server-side / backend layer** of BuildSmart AI.

## Contents

| Path | Purpose |
| --- | --- |
| `lib/` | Server modules: data access (`db.ts`), Prisma seeding (`seed.ts`), authentication (`auth.ts`), Gemini (`gemini.ts`), the AI Copilot service (`copilot/`), and domain helpers. |
| `actions/` | Server actions (e.g. sign-out). |
| `scripts/` | Backend utilities (database seed entrypoint, smoke test). |
| `prisma/` | Prisma schema (`schema.prisma`) and the original SQL migrations (`legacy-migrations/`). |
| `docs/` | Technical / product specification documents for the BuildSmart AI modules. |

## Key imports

The Next.js API routes (`Frontend/app/api/**`) import the backend layer with the
`Backend` alias, for example:

```ts
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { generateCopilotResponse } from '@/Backend/lib/copilot/service';
```

## Database

- Prisma schema: `Backend/prisma/schema.prisma`
- Bootstrap SQL (fresh databases only): `Backend/prisma/legacy-migrations/`
- Prisma CLI config: `prisma.config.ts` (repo root)
- Connection string: `DATABASE_URL` in `Frontend/.env.local` or root `.env` (e.g. `postgresql://postgres:12345678@localhost:5432/build`)

## Scripts

```bash
npm run db:seed             # runs Backend/lib/seed.ts (safe on an existing DB)
npm run db:smoke            # runs Backend/scripts/db-smoke.ts
npm run db:migrate-pglite   # imports old PGlite data into PostgreSQL
```

## Relationship to the frontend

`Frontend/` holds the Next.js application (`Frontend/app/`), shared UI
components, public assets, and frontend configuration. The application shell is
started with `next dev Frontend` (or `next build Frontend` / `next start
Frontend`); those route handlers and server components import this backend
layer with the `Backend` alias.
