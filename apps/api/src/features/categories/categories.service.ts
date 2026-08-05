import { parseCategoryIcon, type CategoryIcon } from "@vectra/types";
import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Category, PrismaClient } from "../../generated/prisma/client.js";
import { toPublic as toPublicExpenseItem } from "../expense-items/expense-items.service.js";
import {
  syncCategoryIconInScenarios,
  syncCategoryNameInScenarios,
} from "../scenarios/scenarios.service.js";
import type { ListCategoriesQuery } from "./categories.schemas.js";

// Prisma types `icon` as a plain string; the API contract narrows it to the
// CATEGORY_ICON_NAMES vocabulary. Retiring an icon id from that list would
// otherwise turn every row still holding it into a failed response, so an
// unrecognized value degrades to the fallback instead of 500ing the request.
export type PublicCategory = Omit<Category, "icon"> & { icon: CategoryIcon };

export function toPublic(category: Category): PublicCategory {
  return { ...category, icon: parseCategoryIcon(category.icon) };
}

async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  type: Category["type"],
  excludeId?: string,
): Promise<void> {
  // Uniqueness applies to active categories only: an archived "Comida" must
  // not block creating a fresh one.
  const duplicate = await prisma.category.findFirst({
    where: {
      userId,
      type,
      archivedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict(`An active ${type.toLowerCase()} category named "${name}" already exists`);
  }
}

function assertNotSystem(category: Category, action: string): void {
  if (category.isSystem) {
    throw conflict(`"${category.name}" is a system category and cannot be ${action}`);
  }
}

export async function listCategories(
  prisma: PrismaClient,
  userId: string,
  query: ListCategoriesQuery,
): Promise<{ data: PublicCategory[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.type && { type: query.type }),
    ...(query.includeArchived ? {} : { archivedAt: null }),
  };

  const [totalItems, data] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: data.map(toPublic), meta: buildMeta(query, totalItems) };
}

export async function getCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicCategory> {
  return toPublic(await findOwnedOrFail(prisma.category, id, userId, "Category"));
}

export async function createCategory(
  prisma: PrismaClient,
  userId: string,
  input: { name: string; type: Category["type"]; icon: CategoryIcon },
): Promise<PublicCategory> {
  await assertNameAvailable(prisma, userId, input.name, input.type);
  return toPublic(await prisma.category.create({ data: { ...input, userId } }));
}

export async function updateCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: { name?: string; icon?: CategoryIcon },
): Promise<PublicCategory> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");

  // The system guard covers the name only: "Sin categorizar" must keep its
  // name (other flows fall back to it) but there is no reason it cannot carry
  // an icon, and the scenario composer needs every category to have one.
  if (input.name !== undefined) {
    assertNotSystem(category, "renamed");
    await assertNameAvailable(prisma, userId, input.name, category.type, id);
  }

  const updated = await prisma.category.update({ where: { id }, data: input });

  // Neither a rename nor a new icon carries financial impact, so both sync
  // into every live scenario snapshot right away — never a "would you like to
  // update" decision (RFC-0023.3), which stays reserved for changes that move
  // a total.
  if (input.name !== undefined) {
    await syncCategoryNameInScenarios(prisma, id, updated.name);
  }
  if (input.icon !== undefined) {
    await syncCategoryIconInScenarios(prisma, id, updated.icon);
  }

  return toPublic(updated);
}

export async function archiveCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicCategory> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");
  assertNotSystem(category, "archived");

  if (category.archivedAt) {
    return toPublic(category);
  }

  // Budgets archive in cascade with their category (RFC-0006 §7), and so do
  // its expense items: retiring an area of spending retires what it holds
  // (RFC-0021). Neither cascades back on unarchive — see below.
  const archivedAt = new Date();
  const [archived] = await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { archivedAt } }),
    prisma.budget.updateMany({ where: { categoryId: id, archivedAt: null }, data: { archivedAt } }),
    prisma.expenseItem.updateMany({
      where: { categoryId: id, archivedAt: null },
      data: { archivedAt },
    }),
  ]);

  return toPublic(archived);
}

export async function unarchiveCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicCategory> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");

  if (!category.archivedAt) {
    return toPublic(category);
  }

  // Restoring the name must not collide with an active category created since.
  await assertNameAvailable(prisma, userId, category.name, category.type, id);

  // Budgets and expense items stay archived: cascade-unarchive could silently
  // reactivate spending limits — or scenario costs — the user forgot about.
  return toPublic(await prisma.category.update({ where: { id }, data: { archivedAt: null } }));
}

export async function deleteCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");
  assertNotSystem(category, "deleted");

  // Entities with history are archived, never deleted (business rule 3).
  const counts = await prisma.category.findUniqueOrThrow({
    where: { id },
    select: {
      _count: {
        select: {
          transactions: true,
          budgets: true,
          recurringTransactions: true,
          expenseItems: true,
        },
      },
    },
  });

  const { transactions, budgets, recurringTransactions, expenseItems } = counts._count;
  if (transactions > 0 || budgets > 0 || recurringTransactions > 0 || expenseItems > 0) {
    throw conflict("Category has associated records; archive it instead");
  }

  await prisma.category.delete({ where: { id } });
}

// Alternative to deleteCategory when the only obstacle is expense items:
// moves them to `targetCategoryId` first so none is ever left without a
// category, then deletes in the same transaction. Ledger records
// (transactions/budgets/recurringTransactions) still block it — those keep
// requiring archive, same as deleteCategory.
export async function deleteCategoryWithReassignment(
  prisma: PrismaClient,
  userId: string,
  id: string,
  targetCategoryId: string,
): Promise<{ movedCount: number }> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");
  assertNotSystem(category, "deleted");

  if (targetCategoryId === id) {
    throw badRequest("Target category must be different from the category being deleted");
  }

  const counts = await prisma.category.findUniqueOrThrow({
    where: { id },
    select: {
      _count: { select: { transactions: true, budgets: true, recurringTransactions: true } },
    },
  });
  const { transactions, budgets, recurringTransactions } = counts._count;
  if (transactions > 0 || budgets > 0 || recurringTransactions > 0) {
    throw conflict("Category has associated records; archive it instead");
  }

  const target = await findOwnedOrFail(prisma.category, targetCategoryId, userId, "Category");
  if (target.type !== category.type) {
    throw badRequest("Target category must be the same type as the category being deleted");
  }
  if (target.archivedAt) {
    throw badRequest("Cannot move products into an archived category");
  }

  const [{ count: movedCount }] = await prisma.$transaction([
    prisma.expenseItem.updateMany({
      where: { categoryId: id, userId },
      data: { categoryId: targetCategoryId },
    }),
    prisma.category.delete({ where: { id } }),
  ]);

  return { movedCount };
}

// "¿Cuánto gasto en esta área?" (ADR-0006) — derived, never stored: sums the
// category's active expense items the same way a Scenario sums its
// ScenarioItems (prorate YEARLY, exclude ONE_TIME from the recurring total).
export async function getCategorySummary(prisma: PrismaClient, userId: string, id: string) {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");

  const expenseItems = await prisma.expenseItem.findMany({
    where: { categoryId: id, userId, archivedAt: null },
    orderBy: { name: "asc" },
  });

  let monthly = 0;
  let oneTimeTotal = 0;
  for (const item of expenseItems) {
    const amount = Number(item.amount);
    if (item.frequency === "ONE_TIME") {
      oneTimeTotal += amount;
    } else {
      monthly += toMonthlyEquivalent(amount, item.frequency);
    }
  }

  return {
    category: toPublic(category),
    totals: toProjection(monthly),
    oneTimeTotal,
    items: expenseItems.map(toPublicExpenseItem),
  };
}
