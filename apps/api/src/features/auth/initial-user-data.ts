import type { Prisma, TransactionType } from "../../generated/prisma/client.js";

// Data every user starts with. Created inside the registration transaction
// (and reused by the dev seed) so "Sin categorizar" never depends on a seed
// having run — risk raised in RFC-0008, closed here (RFC-0010).

// "Sin categorizar" exists once per TransactionType: a category is either
// expense or income, never both (business rule 2), and transactions always
// require a category (resolved open question 3).
export const DEFAULT_CATEGORIES: { name: string; type: TransactionType }[] = [
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

export const DEFAULT_ACCOUNT_NAME = "Efectivo";

export async function createInitialUserData(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
  });

  await tx.account.create({
    data: { userId, name: DEFAULT_ACCOUNT_NAME, type: "CASH", currency },
  });
}
