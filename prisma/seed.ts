import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import type { AssetType } from "../src/generated/prisma/client";

type SeedAsset = {
  assetVisionId: string | null;
  assetNumber: string;
  name: string;
  type: AssetType;
  roadName: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  parentDirection?: string | null;
  parentChainage?: number | null;
  parentAssetCode?: string | null;
  parentAssetName?: string | null;
  classification?: string | null;
  notes?: string | null;
};

async function main() {
  console.log("Seeding VenInspect...");

  await prisma.notification.deleteMany();
  await prisma.defect.deleteMany();
  await prisma.inspectionCategory.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@veninspect.local",
      name: "Alex Admin",
      role: "ADMIN",
      level1Qualified: true,
      level2Qualified: true,
    },
  });

  const l1 = await prisma.user.create({
    data: {
      email: "l1@veninspect.local",
      name: "Sam Level1",
      role: "INSPECTOR",
      level1Qualified: true,
      level2Qualified: false,
    },
  });

  const l2 = await prisma.user.create({
    data: {
      email: "l2@veninspect.local",
      name: "Jordan Level2",
      role: "INSPECTOR",
      level1Qualified: true,
      level2Qualified: true,
    },
  });

  const seedPath = path.join(__dirname, "seed-data", "assets-bridges-culverts.json");
  const assetsJson = JSON.parse(fs.readFileSync(seedPath, "utf8")) as SeedAsset[];

  // Ensure Forsyth example exists for report demos even if not in export
  if (!assetsJson.some((a) => a.assetNumber === "SN2656")) {
    assetsJson.push({
      assetVisionId: null,
      assetNumber: "SN2656",
      name: "FORSYTH RD | Bridge",
      type: "BRIDGE",
      roadName: "Forsyth Rd",
      location: "Example corridor",
      latitude: null,
      longitude: null,
      notes: "Demo asset for report-style previews",
    });
  }

  // Placeholder noise wall until a dedicated export is imported
  if (!assetsJson.some((a) => a.type === "NOISE_WALL")) {
    assetsJson.push({
      assetVisionId: null,
      assetNumber: "NW-0001",
      name: "SAMPLE RD | Noise Wall",
      type: "NOISE_WALL",
      roadName: "Sample Rd",
      location: "Placeholder — replace via management import",
      latitude: null,
      longitude: null,
    });
  }

  for (const a of assetsJson) {
    await prisma.asset.create({
      data: {
        assetNumber: a.assetNumber,
        assetVisionId: a.assetVisionId,
        name: a.name,
        type: a.type,
        roadName: a.roadName || "Unknown Road",
        location: a.location ?? null,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        parentDirection: a.parentDirection ?? null,
        parentChainage: a.parentChainage ?? null,
        parentAssetCode: a.parentAssetCode ?? null,
        parentAssetName: a.parentAssetName ?? null,
        classification: a.classification ?? null,
        notes: a.notes ?? null,
      },
    });
  }

  const forsyth = await prisma.asset.findUniqueOrThrow({
    where: { assetNumber: "SN2656" },
  });

  await prisma.inspection.create({
    data: {
      assetId: forsyth.id,
      level: "LEVEL_1",
      status: "APPROVED",
      inspectedAt: new Date("2023-08-01"),
      submittedAt: new Date("2023-08-01T10:00:00"),
      approvedAt: new Date("2023-08-02"),
      generalComments:
        "Routine Level 1 — sample historical report (PDF-style output later).",
      createdById: l1.id,
      approvedById: l2.id,
      folderKey: "01082023",
      titleLabel: "Forsyth Rd - SN2656 - 01082023",
      categories: {
        create: [
          {
            category: "Superstructure",
            subcategory: "Deck",
            comments: "Minor surface wear. No immediate action.",
          },
          {
            category: "Substructure",
            subcategory: "Abutment A",
            comments: "Vegetation present at toe — clear on next cycle.",
          },
        ],
      },
      defects: {
        create: [
          {
            defectCode: "SN2656-D001",
            category: "Superstructure",
            subcategory: "Deck",
            description: "Hairline cracking in asphalt wearing surface",
            comments: "Monitor for water ingress.",
            severity: "LOW",
          },
        ],
      },
    },
  });

  const pendingL2 = await prisma.inspection.create({
    data: {
      assetId: forsyth.id,
      level: "LEVEL_2",
      status: "PENDING_APPROVAL",
      inspectedAt: new Date(),
      submittedAt: new Date(),
      generalComments: "Level 2 draft prepared on site by Level 1 inspector.",
      createdById: l1.id,
      requiresLevel2Approval: true,
      folderKey: "19072026",
      titleLabel: "Forsyth Rd - SN2656 - 19072026",
      categories: {
        create: [
          {
            category: "Superstructure",
            subcategory: "Beams / Girders",
            comments: "Paint loss on outer girder flange.",
          },
        ],
      },
      defects: {
        create: [
          {
            defectCode: "SN2656-D002",
            category: "Superstructure",
            subcategory: "Beams / Girders",
            description: "Corrosion / paint failure on outer girder",
            comments: "Requires Level 2 confirmation of extent.",
            severity: "MEDIUM",
          },
        ],
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: l2.id,
      inspectionId: pendingL2.id,
      title: "Level 2 verification required",
      message: `SN2656 Forsyth Road Bridge — Level 2 inspection submitted by ${l1.name} awaiting your approval.`,
    },
  });

  console.log("Seed complete.");
  console.log(`  Users: ${admin.email}, ${l1.email}, ${l2.email}`);
  console.log(`  Assets loaded: ${assetsJson.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
