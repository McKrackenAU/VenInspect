import "dotenv/config";
import { prisma } from "../src/lib/db";

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

  const forsyth = await prisma.asset.create({
    data: {
      assetNumber: "SN2656",
      name: "Forsyth Road Bridge",
      type: "BRIDGE",
      roadName: "Forsyth Rd",
      location: "Example corridor — replace with real site details",
      level1IntervalYears: 3,
      level2IntervalYears: 5,
    },
  });

  const culvert = await prisma.asset.create({
    data: {
      assetNumber: "DR-0142",
      name: "Creek Crossing Culvert",
      type: "DRAINAGE",
      roadName: "Ridge Track",
      location: "Chainage 12.4 km",
      level1IntervalYears: 3,
      level2IntervalYears: 5,
    },
  });

  await prisma.inspection.create({
    data: {
      assetId: forsyth.id,
      level: "LEVEL_1",
      status: "APPROVED",
      inspectedAt: new Date("2023-08-01"),
      submittedAt: new Date("2023-08-01"),
      approvedAt: new Date("2023-08-02"),
      generalComments: "Routine Level 1 — sample historical report (PDF-style output later).",
      createdById: l1.id,
      approvedById: l2.id,
      requiresLevel2Approval: false,
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
      categories: {
        create: [
          {
            category: "Superstructure",
            subcategory: "Beams / Girders",
            comments: "Paint loss on outer girder flange.",
          },
          {
            category: "Approaches",
            subcategory: "Approach A",
            comments: "Settlement at joint — measure on verification visit.",
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
            photoPath: null,
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

  await prisma.inspection.create({
    data: {
      assetId: culvert.id,
      level: "LEVEL_1",
      status: "APPROVED",
      inspectedAt: new Date("2024-11-15"),
      submittedAt: new Date("2024-11-15"),
      approvedAt: new Date("2024-11-16"),
      generalComments: "Inlet clear, barrel condition fair.",
      createdById: l1.id,
      approvedById: admin.id,
      categories: {
        create: [
          {
            category: "Drainage",
            subcategory: "Inlet",
            comments: "Light silt — cleaned during visit.",
          },
          {
            category: "Drainage",
            subcategory: "Barrel",
            comments: "No significant deformation observed.",
          },
        ],
      },
    },
  });

  console.log("Seed complete.");
  console.log(`  Users: ${admin.email}, ${l1.email}, ${l2.email}`);
  console.log(`  Assets: ${forsyth.assetNumber}, ${culvert.assetNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
