import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, TransactionType } from "../src/generated/prisma/client.js";

// Development seed: a dev user with the default category set. Default
// categories are per-user in the domain (RFC-0006), so system data cannot
// exist without an owning User; in production this same set is created at
// user registration (auth phase).

const DEV_USER_EMAIL = "dev@vectra.local";

// "Sin categorizar" exists once per TransactionType: a category is either
// expense or income, never both (business rule 2), and transactions always
// require a category (resolved open question 3).
const DEFAULT_CATEGORIES: { name: string; type: TransactionType }[] = [
  { name: "Sin categorizar", type: "EXPENSE" },
  { name: "Sin categorizar", type: "INCOME" },
  { name: "Comida", type: "EXPENSE" },
  { name: "Transporte", type: "EXPENSE" },
  { name: "Vivienda", type: "EXPENSE" },
  { name: "Salud", type: "EXPENSE" },
  { name: "Entretenimiento", type: "EXPENSE" },
  { name: "Compras", type: "EXPENSE" },
  { name: "Suscripciones", type: "EXPENSE" },
  { name: "Salario", type: "INCOME" },
  { name: "Freelance", type: "INCOME" },
  { name: "Otros ingresos", type: "INCOME" },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
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

  const categoryCount = await prisma.category.count({ where: { userId: user.id } });
  console.log(`Seeded user ${user.email} with ${categoryCount} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
