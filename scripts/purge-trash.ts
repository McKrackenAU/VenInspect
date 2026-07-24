/**
 * Hard-delete inspections soft-deleted more than 30 days ago.
 * Run: npx tsx scripts/purge-trash.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

const DAYS = 30;

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const old = await prisma.inspection.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, titleLabel: true },
  });
  for (const row of old) {
    await prisma.inspection.delete({ where: { id: row.id } });
    console.log("purged", row.id, row.titleLabel);
  }
  console.log(`Done. Purged ${old.length} inspection(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
