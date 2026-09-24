# BuildSmart AI — Frontend

This directory contains the **client-facing UI layer** of BuildSmart AI.

> The Next.js App Router tree (`app/`) lives in this folder. The project is
> started with `next dev Frontend`, `next build Frontend`, and
> `next start Frontend`, so the repo root only holds workspace/package
> metadata and the `Backend/` sibling directory.

## Contents

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, route groups, API route handlers, `globals.css`, and `favicon.ico` |
| `components/` | Reusable UI components (buttons, cards, modals, dashboard sidebar, charts, forms, builders, Copilot launcher, etc.) |
| `public/` | Static assets served by Next.js |
| `stitch-ui/` | Design-system reference exports (HTML/PNG screens used during the UI build) |
| `next.config.ts` | Next.js configuration (preview host origins and PostgreSQL/Prisma externalization) |
| `proxy.ts` | Next.js proxy / middleware (currently in preview mode) |
| `tsconfig.json` | TypeScript/alias config for the Frontend project |

## Key imports

Components and app routes are imported with the `Frontend` alias, for example:

```ts
import { PageHeader, Card } from '@/Frontend/components/architect/ui';
import { Sidebar } from '@/Frontend/components/dashboard/Sidebar';
```

Read-only environment configuration lives in `Frontend/.env.local` (see
`Frontend/.env.example` for the template). Do not commit real secrets.

## Dependency

Server-side API, database, authentication, Gemini, and Copilot logic live in
the sibling [`../Backend`](../Backend) directory and are imported by the
`Frontend/app/*` route handlers through the `Backend` alias.
