/**
 * Ensure default admin exists: username root / password calvin.
 * Safe to run repeatedly (upsert by username).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const passwordHash = hashPassword("calvin");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: "root" }, { email: "root@veninspect.local" }] },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: "root",
        email: existing.email || "root@veninspect.local",
        name: existing.name || "Root Admin",
        role: "ADMIN",
        passwordHash,
        level1Qualified: true,
        level2Qualified: true,
      },
    });
    console.log("Updated default admin: root / calvin");
  } else {
    await prisma.user.create({
      data: {
        username: "root",
        email: "root@veninspect.local",
        name: "Root Admin",
        role: "ADMIN",
        passwordHash,
        level1Qualified: true,
        level2Qualified: true,
      },
    });
    console.log("Created default admin: root / calvin");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
