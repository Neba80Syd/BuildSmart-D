# BuildSmart AI — Local Machine Setup Guide

This guide walks you through running BuildSmart AI on your own computer with:

- Node.js + Next.js
- A **local PostgreSQL** database server
- **Prisma** (used as the typed database client / ORM)
- The automatic migration of your old **PGlite** data into local PostgreSQL
- The dev and production commands you should use

> This project currently uses **PostgreSQL**, not PGlite, at runtime. PGlite is
> only a dev dependency that exists so the import script
> (`npm run db:migrate-pglite`) can read an old PGlite data directory and copy
> it into PostgreSQL.

---

## 1. Prerequisites

Install these before anything else:

| Tool | Recommended version | Why |
| --- | --- | --- |
| **Node.js + npm** | Node **22.x LTS** (requires ≥ 22.6) | The repo uses `node --experimental-strip-types`, which is only available in Node 22.6+. |
| **Git** | Latest | To clone / update the repository. |
| **PostgreSQL** | PostgreSQL **14, 15, 16, 17** | The app connects to a real local PostgreSQL server. |
| **psql** | Same as PostgreSQL | Useful for creating the database and checking connections. |

Check your current versions:

```bash
node -v
npm -v
psql --version
```

If `psql` is missing, that's fine for running the app, but you should install it
or use `pgAdmin` / the PostgreSQL shell for the one-time database commands below.

---

## 2. Get the project code

```bash
git clone https://github.com/Neba80Syd/Arena-Project.git
cd Arena-Project
```

If you already have the code, just make sure you are at the repository root
where `package.json`, `Frontend/`, `Backend/`, and `prisma.config.ts` live.

```bash
# verify you're in the right folder
ls
# you should see: Backend  Frontend  README.md  package.json  prisma.config.ts  ...
```

---

## 3. Install dependencies

```bash
npm install
```

This installs everything including:

- `@prisma/client`, `@prisma/adapter-pg`, `pg` — Prisma + PostgreSQL
- `@electric-sql/pglite` — used only by the old-PGlite import script
- Next.js, React, Tailwind, Auth.js

> If you later get errors like `Cannot find module '@prisma/client'`, you can
> safely run `npm install` again.

---

## 4. Create the local environment file

The app reads its configuration from **`Frontend/.env.local`** (the root `.env`
is also supported).

Create it from the template:

```bash
cp Frontend/.env.example Frontend/.env.local
```

Then edit `Frontend/.env.local` and set at least these values:

```dotenv
DATABASE_URL="postgresql://postgres:12345678@localhost:5432/build"
AUTH_SECRET="replace-with-a-long-random-string"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
```

> **Never commit this file.** It is already ignored by `.gitignore`
> (`.env.local` is excluded).

If your PostgreSQL credentials differ, change `DATABASE_URL` accordingly:

```dotenv
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/build"
```

---

## 5. Set up your local PostgreSQL database

The default connection string used throughout the project is:

```text
postgresql://postgres:12345678@localhost:5432/build
```

You need a running PostgreSQL server with:

1. A PostgreSQL superuser named `postgres`
2. Its password set to `12345678` (or your own value)
3. A database named `build`

### 5a. Install PostgreSQL (one-time)

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y postgresql postgresql-client

# start the service
sudo systemctl enable --now postgresql
sudo systemctl status postgresql
```

#### macOS (Homebrew)

```bash
brew install postgresql@16
# add the binaries to PATH for this terminal
export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
# start the service
brew services start postgresql@16
```

#### Windows

1. Download and run the installer from <https://www.postgresql.org/download/windows/>.
2. Choose a version (16 or 17 recommended).
3. During installation, set the **postgres superuser password** (e.g. `12345678`).
4. Keep the default port **5432**.
5. Add `C:\Program Files\PostgreSQL\16\bin` to your PATH, or call `psql` by its
   full path.

To start the Windows service:

```powershell
net start postgresql-x64-16
```

### 5b. Create the `build` database and set the password

#### Linux / macOS (bash)

```bash
# set the postgres user's password (if you haven't already)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '12345678';"

# create the database (ignore the error if it already exists)
sudo -u postgres psql -c "CREATE DATABASE build;"
```

If your `psql` is on the PATH and TCP authentication works, you can also run:

```bash
psql -U postgres -h localhost -c "ALTER USER postgres WITH PASSWORD '12345678';"
psql -U postgres -h localhost -c "CREATE DATABASE build;"
```

> On macOS Homebrew installs, the default superuser is usually your macOS
> username, not `postgres`. To keep the standard config, create the `postgres`
> role:
>
> ```bash
> createuser -s postgres
> psql -d postgres -c "ALTER USER postgres WITH PASSWORD '12345678';"
> psql -d postgres -c "CREATE DATABASE build;"
> ```

#### Windows (PowerShell)

```powershell
# If PostgreSQL binaries are in PATH:
psql -U postgres -c "ALTER USER postgres WITH PASSWORD '12345678';"
psql -U postgres -c "CREATE DATABASE build;"
```

If `psql` isn't in PATH, use the full path:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD '12345678';"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE build;"
```

### 5c. Verify the connection

```bash
psql "postgresql://postgres:12345678@localhost:5432/build" -c "SELECT 1;"
```

You should see:

```text
 ?column?
----------
        1
(1 row)
```

---

## 6. Prepare Prisma (generate the client)

Prisma is the ORM used by all backend/API data access. You do **not** need a
Prisma server — it is a library.

Before running the app (and after any `npm install` or schema change), make
sure the Prisma client is generated:

```bash
npm run prisma:generate
```

You should see something like:

```text
✔ Generated Prisma Client (v7.10.0) to ./node_modules/@prisma/client
```

### How Prisma is configured here

- Schema file: `Backend/prisma/schema.prisma`
- Prisma CLI config: `prisma.config.ts` (repo root)
- Connection string: read from `DATABASE_URL`
- Generator helper: `.prisma-tools/fake-schema-engine` (allows `prisma generate`
  to work even when the Prisma schema-engine binary cannot be downloaded)

> **Important:** Use `npm run prisma:generate`, not `npx prisma migrate`.
> This project intentionally does **not** use `prisma migrate` / `prisma db push`
> for table changes. Tables are created automatically from
> `Backend/prisma/legacy-migrations/` when the app first connects to an empty
> database. Running `prisma db push` or `prisma migrate` could alter or recreate
> tables unexpectedly, so avoid them here.

---

## 7. Create the database tables + demo data

Run the seed script. It is **idempotent and safe**:

```bash
npm run db:seed
```

What it does:

1. Connects to PostgreSQL using `DATABASE_URL`.
2. If the database is completely empty, it creates all tables from the original
   SQL migrations in `Backend/prisma/legacy-migrations/`.
3. Creates the AI telemetry tables safely (`CREATE TABLE IF NOT EXISTS`).
4. Inserts demo users, profiles, products, project, floor plans, and blog data
   **only when the database is empty**.
5. Leaves existing rows untouched when run again.

The output ends with a JSON summary of row counts, e.g.:

```text
✅ BuildSmart database ready.
{ "user": 4, "product": 3, "blogPost": 1, ... }
```

---

## 8. Migrate your existing PGlite data to PostgreSQL

If you previously used BuildSmart with **PGlite**, do this after PostgreSQL is
running and `DATABASE_URL` is set. This copies every user table from PGlite into
PostgreSQL **without deleting anything** (`INSERT ... ON CONFLICT DO NOTHING`).

### 8a. Find your old PGlite data folder

The importer looks for:

- `PGLITE_DIR` (if you set it), or
- `.buildsmart-pgdata` in the repo root, or
- `.buildsmart-pgdata` one directory above the repo root

Typical locations used by the old version:

```text
/path/to/repo/.buildsmart-pgdata
/path/to/buildsmart-pgdata
/home/user/buildsmart-pgdata
```

Check whether the folder exists:

```bash
ls -la .buildsmart-pgdata 2>/dev/null || echo "not in repo root"
ls -la ../buildsmart-pgdata 2>/dev/null || echo "not above repo"
```

### 8b. Run the import

If the PGlite folder is at the default location:

```bash
npm run db:migrate-pglite
```

If it is elsewhere, point `PGLITE_DIR` at it:

```bash
# bash / macOS / Linux
PGLITE_DIR=/path/to/buildsmart-pgdata npm run db:migrate-pglite
```

Windows PowerShell:

```powershell
$env:PGLITE_DIR = "C:\path\to\buildsmart-pgdata"
npm run db:migrate-pglite
```

Example:

```bash
PGLITE_DIR=../buildsmart-pgdata npm run db:migrate-pglite
```

Expected output shape:

```text
✅ Connected to PostgreSQL.
📂 Opening old PGlite data at /path/to/buildsmart-pgdata...
Copying users...   COPIED 12 rows (12 inserted into users)
Copying products... COPIED 25 rows (25 inserted into products)
...
✅ Migration complete. No existing PostgreSQL data was deleted.
```

### 8c. After migration

Run the seed once to make sure any missing curated/blog/fixture rows are also
present:

```bash
npm run db:seed
```

Then start the app. PostgreSQL is now the source of truth.

> **Backup tip:** Before running the import on a machine where you care about
> existing PostgreSQL rows, take a backup:
>
> ```bash
> pg_dump "postgresql://postgres:12345678@localhost:5432/build" > build-backup-$(date +%F).sql
> ```

---

## 9. Run the application

### Development mode (recommended while working)

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

You should see the landing page. The first page load may take a moment while
the app connects to PostgreSQL and confirms the schema.

### Production mode

```bash
npm run build
npm run start
```

Then open:

```text
http://localhost:3000
```

---

## 10. Verify everything works

These commands help you confirm the local machine is set up correctly.

### 10a. TypeScript

```bash
npm run typecheck
```

Should end with no errors.

### 10b. Full build

```bash
npm run build
```

Should finish with:

```text
✓ Compiled successfully
```

and list routes such as `/`, `/about`, `/services`, `/marketplace`,
`/testimonials`, `/blog`, `/journal`.

### 10c. Database smoke test

The data-layer smoke test is designed to run against a **throwaway** database,
not your real `build` database, because it writes/creates test rows.

Create a second database and point the smoke test at it:

```bash
# create the throwaway database (Linux/macOS example)
psql -U postgres -h localhost -c "CREATE DATABASE buildsmoke;"
```

Then run:

```bash
DATABASE_URL="postgresql://postgres:12345678@localhost:5432/buildsmoke" npm run db:seed
DATABASE_URL="postgresql://postgres:12345678@localhost:5432/buildsmoke" npm run db:smoke
```

The output should show many `PASS` lines and end with a summary indicating no
failures.

### 10d. Quick page/API checks

With the dev or production server running on port 3000:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/about
curl -I http://localhost:3000/marketplace
curl -I http://localhost:3000/testimonials
curl -I http://localhost:3000/blog
curl -I http://localhost:3000/api/products
```

All should return `200`.

---

## 11. Common mistakes and fixes

### `DATABASE_URL is not set`

You are running a database/script command without an env file.

**Fix:**

```bash
cp Frontend/.env.example Frontend/.env.local
# edit Frontend/.env.local and set DATABASE_URL
```

### `connect ECONNREFUSED ::1:5432` / `127.0.0.1:5432`

PostgreSQL isn't running, or it is on another port.

**Fix:**

```bash
# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# macOS
brew services start postgresql@16
```

Make sure the port in `DATABASE_URL` matches your PostgreSQL port. The default
is `5432`.

### `database "build" does not exist`

**Fix:**

```bash
psql -U postgres -h localhost -c "CREATE DATABASE build;"
```

### `password authentication failed for user "postgres"`

**Fix:**

```bash
psql -U postgres -h localhost -c "ALTER USER postgres WITH PASSWORD '12345678';"
```

Then update `DATABASE_URL` to match the password.

### `role "postgres" does not exist` (usually macOS / Windows / Homebrew)

The superuser is not named `postgres`.

**Fix:** either create it:

```bash
createuser -s postgres
psql -d postgres -c "ALTER USER postgres WITH PASSWORD '12345678';"
```

or update `DATABASE_URL` to use the actual user:

```dotenv
DATABASE_URL="postgresql://yourusername:password@localhost:5432/build"
```

### `Cannot find module '@prisma/client'` or Prisma type errors

**Fix:**

```bash
npm install
npm run prisma:generate
```

### `node: --experimental-strip-types` error / old Node

Your Node version is too old.

**Fix:** install Node **22.x LTS** (or newer). Check with `node -v`.

### Blog page shows “server error” when the database is down

The blog/journal pages gracefully fall back to bundled curated posts when the
database is unavailable. If you still see errors, start PostgreSQL and confirm
`DATABASE_URL` is correct, then run:

```bash
npm run db:seed
```

### Marketplace add-to-cart says “authentication required”

Marketplace browsing is public, but adding to cart / buying requires a real
login. Use one of the demo accounts:

```text
jordan@buildsmart.ai (Client)
elena@buildsmart.ai (Architect)
marcus@buildsmart.ai (Vendor)
admin@buildsmart.ai (Admin)
```

Password: `demo1234`

---

## 12. Safe rules to remember

1. **Run `npm run db:seed`** — it is safe to run multiple times.
2. **Do NOT run `prisma db push` or `prisma migrate`** — the project bootstraps
   its own tables from legacy SQL and these commands can alter/drop schema.
3. **Run `npm run prisma:generate`** after `npm install` or schema updates.
4. **Use a separate database for `db:smoke`** — it creates throwaway rows.
5. **Keep `Frontend/.env.local` out of git.**
6. **Save your PGlite data** — `npm run db:migrate-pglite` never deletes it.
7. If you change `DATABASE_URL` in `.env.local`, restart the app (or re-run the
   npm scripts) before testing.

---

## 13. Quick success checklist

```text
[ ] Node 22.x installed                    → node -v       ✓
[ ] npm installed                          → npm -v        ✓
[ ] PostgreSQL installed and running       → psql ...      ✓
[ ] Frontend/.env.local created            → DATABASE_URL  ✓
[ ] npm install                            → node_modules  ✓
[ ] npm run prisma:generate                → Prisma client ✓
[ ] database "build" created               → CREATE DATABASE ✓
[ ] npm run db:seed                        → tables + demo data ✓
[ ] (optional) npm run db:migrate-pglite   → old PGlite rows copied ✓
[ ] npm run dev / npm run build && npm run start → http://localhost:3000 ✓
```

That's it. With these steps your local machine will run BuildSmart AI on
PostgreSQL, Prisma will be generated and working, and any old PGlite data will
be safely copied into your local PostgreSQL database.
