import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

import {
  DEFAULT_CATEGORIES,
  DEFAULT_ACCOUNT_NAME,
} from "../src/features/auth/initial-user-data.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Development seed: a dev user with the same initial data that production
// registration creates (src/features/auth/initial-user-data.ts).

const DEV_USER_EMAIL = "dev@vectra.local";
const DEV_USER_PASSWORD = "devpassword";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_USER_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    // Backfills the hash for users created before the add_auth migration.
    update: { passwordHash },
    create: {
      email: DEV_USER_EMAIL,
      passwordHash,
      defaultCurrency: "USD",
      timezone: "America/Bogota",
    },
  });

  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: category.name, type: category.type },
    });
    if (!existing) {
      await prisma.category.create({
        data: { ...category, userId: user.id },
      });
    }
  }

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, name: DEFAULT_ACCOUNT_NAME },
  });
  if (!existingAccount) {
    await prisma.account.create({
      data: { userId: user.id, name: DEFAULT_ACCOUNT_NAME, type: "CASH", currency: "USD" },
    });
  }

  const categoryCount = await prisma.category.count({ where: { userId: user.id } });
  console.log(
    `Seeded user ${user.email} (password: ${DEV_USER_PASSWORD}) with ${categoryCount} categories.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
