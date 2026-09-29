import fs from "node:fs";
import path from "node:path";
import type { PrismaConfig } from "prisma";
import dotenv from "dotenv";

// Prisma CLI does not load Next.js .env files automatically in Prisma 7,
// so load the same environment before any CLI command runs. The root .env wins
// over Frontend/.env.local only for keys that were not already set.
for (const file of [path.resolve("Frontend", ".env.local"), path.resolve(".env")]) {
  if (fs.existsSync(file)) dotenv.config({ path: file });
}

export default {
  schema: path.join("Backend", "prisma", "schema.prisma"),
  datasource: {
    url:
      process.env.DATABASE_URL ??
      process.env.PRISMA_DATABASE_URL ??
      "postgresql://postgres:12345678@localhost:5432/build",
  },
} satisfies PrismaConfig;
