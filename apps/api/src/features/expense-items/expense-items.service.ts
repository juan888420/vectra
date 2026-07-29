import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { ExpenseItem, PrismaClient } from "../../generated/prisma/client.js";
import type {
  CreateExpenseItemBody,
  ListExpenseItemsQuery,
  UpdateExpenseItemBody,
} from "./expense-items.schemas.js";

type PublicExpenseItem = Omit<ExpenseItem, "amount"> & { amount: number };

function toPublic(item: ExpenseItem): PublicExpenseItem {
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

export async function updateExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateExpenseItemBody,
): Promise<PublicExpenseItem> {
  const existing = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (input.categoryId) {
    await assertCategoryUsable(prisma, userId, input.categoryId);
  }
  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }

  const item = await prisma.expenseItem.update({ where: { id: existing.id }, data: input });
  return toPublic(item);
}

export async function archiveExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicExpenseItem> {
  const item = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (item.archivedAt) {
    return toPublic(item);
  }

  return toPublic(
    await prisma.expenseItem.update({ where: { id }, data: { archivedAt: new Date() } }),
  );
}

export async function unarchiveExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicExpenseItem> {
  const item = await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");

  if (!item.archivedAt) {
    return toPublic(item);
  }

  // Restoring must not collide with an item created under the same name since,
  // and its category may have been archived in the meantime.
  await assertNameAvailable(prisma, userId, item.name, id);
  await assertCategoryUsable(prisma, userId, item.categoryId);

  return toPublic(await prisma.expenseItem.update({ where: { id }, data: { archivedAt: null } }));
}

// Nothing references an ExpenseItem yet, so deletion is unconditional. The
// Scenario RFC must add the "archive instead" guard here once scenarios can
// hold items (business rule 3), mirroring deleteCategory.
export async function deleteExpenseItem(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.expenseItem, id, userId, "Expense item");
  await prisma.expenseItem.delete({ where: { id } });
}
