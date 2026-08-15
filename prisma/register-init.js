const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");

(async () => {
  const p = new PrismaClient();
  const sql = fs.readFileSync("prisma/migrations/20260815140000_init/migration.sql", "utf8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");
  const tables = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'aimfox' ORDER BY table_name"
  );
  console.log("AIMFOX TABLES:", tables.map((t) => t.table_name).join(", "));
  await p.$executeRawUnsafe(
    "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ($1, $2, NOW(), $1, NULL, NULL, NOW(), 1) ON CONFLICT (id) DO UPDATE SET checksum = EXCLUDED.checksum",
    "20260815140000_init",
    checksum
  );
  console.log("registered:", checksum.slice(0, 12));
  await p.$disconnect();
})().catch((e) => {
  console.error("ERR:", e.message.split("\n")[0]);
  process.exit(1);
});
