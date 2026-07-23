/**
 * Export all Prisma-modelled tables from the current SQLite DB to JSON.
 * Used as the first half of a SQLite → PostgreSQL cutover.
 *
 * Usage (LXC):
 *   sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm run db:export-sqlite
 *
 * Writes: {DATA_DIR}/exports/sqlite-export-<timestamp>.json
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { getDataDir, ensureDataDirs } from "../src/lib/paths";

async function main() {
  ensureDataDirs();
  const outDir = path.join(getDataDir(), "exports");
  fs.mkdirSync(outDir, { recursive: true });

  const [
    users,
    assets,
    inspections,
    inspectionCategories,
    inspectionPermitChecks,
    defects,
    assetDocuments,
    auditAssignments,
    notifications,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.asset.findMany(),
    prisma.inspection.findMany(),
    prisma.inspectionCategory.findMany(),
    prisma.inspectionPermitCheck.findMany(),
    prisma.defect.findMany(),
    prisma.assetDocument.findMany(),
    prisma.auditAssignment.findMany(),
    prisma.notification.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    source: "sqlite",
    counts: {
      users: users.length,
      assets: assets.length,
      inspections: inspections.length,
      inspectionCategories: inspectionCategories.length,
      inspectionPermitChecks: inspectionPermitChecks.length,
      defects: defects.length,
      assetDocuments: assetDocuments.length,
      auditAssignments: auditAssignments.length,
      notifications: notifications.length,
    },
    data: {
      users,
      assets,
      inspections,
      inspectionCategories,
      inspectionPermitChecks,
      defects,
      assetDocuments,
      auditAssignments,
      notifications,
    },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `sqlite-export-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(payload.counts, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
