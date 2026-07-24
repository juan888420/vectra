import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

// Applies a migration folder manually through the driver adapter (pure JS)
// and registers it in _prisma_migrations with Prisma's checksum format
// (sha256 hex of migration.sql), so `prisma migrate status` stays in sync.
//
// Needed because Windows App Control blocks Prisma's schema-engine binary
// on this machine, which breaks every `prisma migrate` command. Remove once
// the binary is allowed.
//
// Usage: pnpm db:apply <migration_folder_name>

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("Usage: pnpm db:apply <migration_folder_name>");
  process.exit(1);
}

const sql = readFileSync(`prisma/migrations/${migrationName}/migration.sql`, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const already = await prisma.$queryRaw<{ id: string }[]>`
  SELECT id FROM "_prisma_migrations" WHERE migration_name = ${migrationName}
`;
if (already.length > 0) {
  console.log(`Migration ${migrationName} already registered, nothing to do.`);
  await prisma.$disconnect();
  process.exit(0);
}

const statements = sql
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement.replace(/--.*$/gm, "").trim().length > 0);

await prisma.$transaction(async (tx) => {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement);
  }
  await tx.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
    randomUUID(),
    checksum,
    migrationName,
  );
});

console.log(`Applied and registered ${migrationName} (checksum ${checksum.slice(0, 12)}…)`);
await prisma.$disconnect();
