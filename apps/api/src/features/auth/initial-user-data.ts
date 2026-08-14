import type { Prisma, TransactionType } from "../../generated/prisma/client.js";

// Data every user starts with. Created inside the registration transaction
// (and reused by the dev seed) so a fresh account has something to organize
// products with from the first screen — risk raised in RFC-0008, closed in
// RFC-0010.

// The two "Sin categorizar" system categories this list used to seed were
// dropped after ADR-0007: they existed as the re-categorization fallback for
// transactions, and the ledger no longer has an exposed surface. Everything
// here is now an ordinary category the user can rename, archive or delete.
export const DEFAULT_CATEGORIES: {
  name: string;
  type: TransactionType;
}[] = [
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

export async function createInitialUserData(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({ ...category, userId })),
  });
}
