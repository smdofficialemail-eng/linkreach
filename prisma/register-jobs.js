// Registers a hand-applied migration in Prisma's _prisma_migrations table
// so `prisma migrate deploy` on Vercel sees it as applied.
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "migrations", "20260816100000_extension_jobs");
const NAME = "20260816100000_extension_jobs";

async function main() {
  const sql = fs.readFileSync(path.join(DIR, "migration.sql"), "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  const id = "c" + crypto.randomBytes(12).toString("hex");

  const prisma = new PrismaClient();
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM "_prisma_migrations" WHERE migration_name = '${NAME}'`
  );
  if (existing.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, migration_name, started_at, finished_at, applied_steps_count, logs, rolled_back_at, checksum) VALUES ('${id}', '${NAME}', NOW(), NOW(), 1, NULL, NULL, '${checksum}')`
    );
    console.log("Registered migration:", NAME);
  } else {
    console.log("Migration already registered:", NAME);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
