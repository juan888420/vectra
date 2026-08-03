import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { ExpenseItem, PrismaClient } from "../../generated/prisma/client.js";
import { reconcileExpenseItemScenarios } from "../scenarios/scenarios.service.js";
import type { ScenarioImpact } from "../scenarios/scenarios.service.js";
import type {
  CreateExpenseItemBody,
  ListExpenseItemsQuery,
  UpdateExpenseItemBody,
} from "./expense-items.schemas.js";

export type PublicExpenseItem = Omit<ExpenseItem, "amount"> & { amount: number };

export function toPublic(item: ExpenseItem): PublicExpenseItem {
  return { ...item, amount: Number(item.amount) };
}

// "Reuse before duplicating" (ADR-0005) taken literally: an item exists once
// per user, so a second active "Netflix" is rejected instead of silently
// creating a rival copy whose price can drift. Scoped to active items only —
// an archived "Netflix" must not block creating a fresh one, same as Category.
async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await prisma.expenseItem.findFirst({
    where: {
      userId,
      archivedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict(`An active expense item named "${name}" already exists`);
  }
}

async function assertCategoryUsable(
  prisma: PrismaClient,
  userId: string,
  categoryId: string,
): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw badRequest("Category not found");
  }
  if (category.archivedAt) {
    throw badRequest("Cannot use an archived category");
  }
  // An expense item is a cost, so it can only live in an EXPENSE category
  // (same reasoning as budgets in RFC-0013).
  if (category.type !== "EXPENSE") {
    throw badRequest("Expense items can only belong to expense categories");
  }
}

export async function listExpenseItems(
  prisma: PrismaClient,
  userId: string,
  query: ListExpenseItemsQuery,
): Promise<{ data: PublicExpenseItem[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.frequency && { frequency: query.frequency }),
    ...(query.includeArchived ? {} : { archivedAt: null }),
  };

  const [totalItems, items] = await prisma.$transaction([
    prisma.expenseItem.count({ where }),
    prisma.expenseItem.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: items.map(toPublic), meta: buildMeta(query, totalItems) };
}

export async function getExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicExpenseItem> {
  return toPublic(await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item"));
}

export async function createExpenseItem(
  prisma: PrismaClient,
  userId: string,
  input: CreateExpenseItemBody,
): Promise<PublicExpenseItem> {
  await assertCategoryUsable(prisma, userId, input.categoryId);
  await assertNameAvailable(prisma, userId, input.name);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const item = await prisma.expenseItem.create({
    data: { ...input, userId, currency: user.defaultCurrency },
  });

  return toPublic(item);
}

export type ExpenseItemMutationResult = ScenarioImpact & { data: PublicExpenseItem };

// Saves immediately, always — the scenarios that use this item never block
// the write. Visual drift (name, category label) syncs into their snapshots
// in the same breath; financial drift (price, frequency, archived) is
// reported back — both which scenarios move and what exactly would change —
// so the caller can ask "¿actualizar ahora?" with the specifics, without a
// second save (RFC-0023.3).
async function finalizeExpenseItemWrite(
  prisma: PrismaClient,
  item: ExpenseItem,
): Promise<ExpenseItemMutationResult> {
  const category = await prisma.category.findUniqueOrThrow({ where: { id: item.categoryId } });
  const impact = await reconcileExpenseItemScenarios(prisma, { ...item, category });
  return { data: toPublic(item), ...impact };
}

export async function updateExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateExpenseItemBody,
): Promise<ExpenseItemMutationResult> {
  const existing = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (input.categoryId) {
    await assertCategoryUsable(prisma, userId, input.categoryId);
  }
  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }

  const item = await prisma.expenseItem.update({ where: { id: existing.id }, data: input });
  return finalizeExpenseItemWrite(prisma, item);
}

export async function archiveExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<ExpenseItemMutationResult> {
  const item = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (item.archivedAt) {
    return finalizeExpenseItemWrite(prisma, item);
  }

  const archived = await prisma.expenseItem.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  return finalizeExpenseItemWrite(prisma, archived);
}

export async function unarchiveExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<ExpenseItemMutationResult> {
  const item = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (!item.archivedAt) {
    return finalizeExpenseItemWrite(prisma, item);
  }

  // Restoring must not collide with an item created under the same name since,
  // and its category may have been archived in the meantime.
  await assertNameAvailable(prisma, userId, item.name, id);
  await assertCategoryUsable(prisma, userId, item.categoryId);

  const restored = await prisma.expenseItem.update({
    where: { id },
    data: { archivedAt: null },
  });
  return finalizeExpenseItemWrite(prisma, restored);
}

// Items referenced by a scenario are archived, never deleted (business rule
// 3, mirroring deleteCategory) — a ScenarioItem snapshot still points at
// this row, and deleting it out from under a simulation would break history.
export async function deleteExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  const counts = await prisma.expenseItem.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { scenarioItems: true } } },
  });
  if (counts._count.scenarioItems > 0) {
    throw conflict("Expense item is referenced by a scenario; archive it instead");
  }

  await prisma.expenseItem.delete({ where: { id } });
}

// "¿Cuánto me cuesta mantener esto?" (ADR-0006) — derived, never stored. The
// scenario list answers "en qué escenarios se usa": ScenarioItem isn't
// queryable client-side, so this is the one new endpoint this domain needs.
export async function getExpenseItemSummary(prisma: PrismaClient, userId: string, id: string) {
  const item = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  const scenarioItems = await prisma.scenarioItem.findMany({
    where: { expenseItemId: id, scenario: { userId } },
    include: { scenario: true },
    orderBy: { scenario: { name: "asc" } },
  });

  const monthly =
    item.frequency === "ONE_TIME" ? 0 : toMonthlyEquivalent(Number(item.amount), item.frequency);

  return {
    item: toPublic(item),
    totals: toProjection(monthly),
    scenarios: scenarioItems.map((scenarioItem) => ({
      id: scenarioItem.scenario.id,
      name: scenarioItem.scenario.name,
      status: scenarioItem.scenario.status,
    })),
  };
}
