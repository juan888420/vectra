import type { CategoryIcon } from "@vectra/types";

import type { Prisma, TransactionType } from "../../generated/prisma/client.js";

// Data every user starts with. Created inside the registration transaction
// (and reused by the dev seed) so "Sin categorizar" never depends on a seed
// having run — risk raised in RFC-0008, closed here (RFC-0010).

// "Sin categorizar" exists once per TransactionType: a category is either
// expense or income, never both (business rule 2), and transactions always
// require a category (resolved open question 3). They are system categories:
// protected from rename/archive/delete because future flows use them as the
// re-categorization fallback.
// `icon` is required (RFC-0025): the scenario composer navigates categories by
// icon alone, so a starter set without icons would be unusable there. Keep
// these in sync with the backfill in the add_category_icon migration.
export const DEFAULT_CATEGORIES: {
  name: string;
  type: TransactionType;
  icon: CategoryIcon;
  isSystem?: boolean;
}[] = [
  { name: "Sin categorizar", type: "EXPENSE", icon: "tag", isSystem: true },
  { name: "Sin categorizar", type: "INCOME", icon: "tag", isSystem: true },
  { name: "Comida", type: "EXPENSE", icon: "utensils" },
  { name: "Transporte", type: "EXPENSE", icon: "car" },
  { name: "Vivienda", type: "EXPENSE", icon: "house" },
  { name: "Salud", type: "EXPENSE", icon: "heart-pulse" },
  { name: "Entretenimiento", type: "EXPENSE", icon: "gamepad-2" },
  { name: "Compras", type: "EXPENSE", icon: "shopping-bag" },
  { name: "Suscripciones", type: "EXPENSE", icon: "credit-card" },
  { name: "Salario", type: "INCOME", icon: "briefcase" },
  { name: "Freelance", type: "INCOME", icon: "laptop" },
  { name: "Otros ingresos", type: "INCOME", icon: "banknote" },
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
