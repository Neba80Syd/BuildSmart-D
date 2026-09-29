// BuildSmart AI — one-time/local migration from the old PGlite data directory
// to a normal PostgreSQL server.
//
// WHAT IT DOES
// ------------
// 1. Opens the existing PGlite data directory (default: `.buildsmart-pgdata`).
// 2. Connects to PostgreSQL using DATABASE_URL.
// 3. Bootstraps PostgreSQL only if it is brand new (same non-destructive rules
//    as the app).
// 4. Copies every user table from PGlite into PostgreSQL using INSERT ... ON
//    CONFLICT DO NOTHING, so nothing in the local database is deleted and rows
//    already present are preserved (never duplicated).
//
// USAGE
// -----
//   # From the repository root, after setting DATABASE_URL in .env:
//   PGLITE_DIR=.buildsmart-pgdata npm run db:migrate-pglite
//
//   # If the old PGlite data was in the previously documented location:
//   PGLITE_DIR=/home/user/buildsmart-pgdata npm run db:migrate-pglite
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getPgPool, ensureDatabaseSchema } from "../lib/pg-setup.ts";

const PGLITE_DIR =
  process.env.PGLITE_DIR ||
  (fs.existsSync(path.resolve(".buildsmart-pgdata"))
    ? path.resolve(".buildsmart-pgdata")
    : path.resolve("..", ".buildsmart-pgdata"));

const BATCH = 200;

interface ColumnInfo {
  name: string;
}

async function getTableNames(
  client: PGlite,
): Promise<Array<{ table: string; columns: Set<string> }>> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`,
  );
  const tableNames = (result.rows ?? [])
    .map((row) => row.table_name)
    .filter((name) => !name.startsWith("_") && name !== "drizzle");
  const tables: Array<{ table: string; columns: Set<string> }> = [];
  for (const table of tableNames) {
    const cols = await client.query<ColumnInfo>(
      `SELECT column_name AS name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      [table],
    );
    tables.push({
      table,
      columns: new Set((cols.rows ?? []).map((col) => col.name)),
    });
  }
  return tables;
}

async function getPostgresColumns(pool: ReturnType<typeof getPgPool>, table: string): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Set((result.rows ?? []).map((row) => row.column_name));
}

function buildInsert(table: string, columns: string[]): string {
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  const params = columns.map((_, index) => `$${index + 1}`).join(", ");
  return `INSERT INTO "${table}" (${quoted}) VALUES (${params}) ON CONFLICT DO NOTHING`;
}

async function copyTable(
  client: PGlite,
  pool: ReturnType<typeof getPgPool>,
  table: string,
  sourceColumns: Set<string>,
  targetColumns: Set<string>,
): Promise<number> {
  const columns = [...sourceColumns].filter((column) => targetColumns.has(column));
  if (columns.length === 0) {
    console.log(`  SKIP ${table} — no common columns`);
    return 0;
  }

  const all = await client.query<Record<string, unknown>>(
    `SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM "${table}"`,
  );
  const rows = all.rows ?? [];
  const insert = buildInsert(table, columns);
  let total = 0;

  for (let index = 0; index < rows.length; index += BATCH) {
    if (!pool) throw new Error("pg pool missing");
    const slice = rows.slice(index, index + BATCH);
    const values = slice.flatMap((row) => columns.map((column) => row[column]));
    if (values.length === 0) continue;
    const placeholders = slice.map((_, rowIndex) => {
      const start = rowIndex * columns.length + 1;
      const end = start + columns.length - 1;
      return `(${Array.from({ length: columns.length }, (_, i) => `$${start + i}`).join(", ")})`;
    });
    const sql = `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES ${placeholders.join(", ")} ON CONFLICT DO NOTHING`;
    const res = await pool.query(sql, values);
    total += res.rowCount ?? 0;
  }

  console.log(`  COPIED ${rows.length} rows (${total} inserted into ${table})`);
  return total;
}

async function main() {
  if (!fs.existsSync(PGLITE_DIR)) {
    throw new Error(
      `PGlite data directory not found at ${PGLITE_DIR}. Set PGLITE_DIR to the path that contains your old .buildsmart-pgdata data.`,
    );
  }

  const pool = getPgPool();
  console.log("✅ Connected to PostgreSQL.");
  await ensureDatabaseSchema(pool);

  console.log(`📂 Opening old PGlite data at ${PGLITE_DIR}...`);
  const client = new PGlite(PGLITE_DIR);
  await client.waitReady;

  const tables = await getTableNames(client);
  const totals: Record<string, number> = {};
  for (const table of tables) {
    const targetColumns = await getPostgresColumns(pool, table.table);
    process.stdout.write(`Copying ${table.table}... `);
    totals[table.table] = await copyTable(client, pool, table.table, table.columns, targetColumns);
  }

  console.log("\n--- Summary ---");
  for (const [table, count] of Object.entries(totals)) {
    console.log(`${table}: ${count}`);
  }
  console.log("\n✅ Migration complete. No existing PostgreSQL data was deleted.");

  await client.close();
  await pool.end();
}

main().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
