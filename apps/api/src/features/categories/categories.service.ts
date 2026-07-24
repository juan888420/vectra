import { conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Category, PrismaClient } from "../../generated/prisma/client.js";
import type { ListCategoriesQuery } from "./categories.schemas.js";

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
): Promise<{ data: Category[]; meta: PageMeta }> {
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

  return { data, meta: buildMeta(query, totalItems) };
}

export async function getCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Category> {
  return findOwnedOrFail(prisma.category, id, userId, "Category");
}

export async function createCategory(
  prisma: PrismaClient,
  userId: string,
  input: { name: string; type: Category["type"] },
): Promise<Category> {
  await assertNameAvailable(prisma, userId, input.name, input.type);
  return prisma.category.create({ data: { ...input, userId } });
}

export async function updateCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: { name: string },
): Promise<Category> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");
  assertNotSystem(category, "renamed");
  await assertNameAvailable(prisma, userId, input.name, category.type, id);
  return prisma.category.update({ where: { id }, data: input });
}

export async function archiveCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Category> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");
  assertNotSystem(category, "archived");

  if (category.archivedAt) {
    return category;
  }

  // Budgets archive in cascade with their category (RFC-0006 §7).
  const [archived] = await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { archivedAt: new Date() } }),
    prisma.budget.updateMany({
      where: { categoryId: id, archivedAt: null },
      data: { archivedAt: new Date() },
    }),
  ]);

  return archived;
}

export async function unarchiveCategory(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Category> {
  const category = await findOwnedOrFail(prisma.category, id, userId, "Category");

  if (!category.archivedAt) {
    return category;
  }

  // Restoring the name must not collide with an active category created since.
  await assertNameAvailable(prisma, userId, category.name, category.type, id);

  // Budgets stay archived: cascade-unarchive could silently reactivate
  // spending limits the user forgot about.
  return prisma.category.update({ where: { id }, data: { archivedAt: null } });
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
      _count: { select: { transactions: true, budgets: true, recurringTransactions: true } },
    },
  });

  const { transactions, budgets, recurringTransactions } = counts._count;
  if (transactions > 0 || budgets > 0 || recurringTransactions > 0) {
    throw conflict("Category has associated records; archive it instead");
  }

  await prisma.category.delete({ where: { id } });
}
