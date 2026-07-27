/**
 * Ensure the root system admin exists (username: root).
 * Creates the account only when missing — never overwrites an existing password.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/passwords";

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: "root" }, { email: "root@veninspect.local" }] },
  });

  if (existing) {
    // Keep password as-is. Only ensure username/role/flags stay correct.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: "root",
        email: existing.email || "root@veninspect.local",
        name: existing.name || "Root Admin",
        role: "ADMIN",
        level1Qualified: true,
        level2Qualified: true,
      },
    });
    console.log(
      "Root system admin already present (password left unchanged).",
    );
    return;
  }

  const passwordHash = hashPassword("calvin");
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
  console.log("Created root system admin: root / calvin (change on server after first login).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
