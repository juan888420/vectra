import { badRequest, notFound } from "./http-errors.js";
import type { Account, Category, PrismaClient } from "../generated/prisma/client.js";

// Selecting an account or category for a *new* money movement (a transaction
// or a recurring template) always applies the same two rules: it must belong
// to the caller, and an archived one can never be selected (business rule 4).
// Shared here so transactions/ and recurring-transactions/ cannot drift apart.

export async function resolveActiveAccount(
  prisma: PrismaClient,
  userId: string,
  accountId: string,
): Promise<Account> {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) {
    throw notFound("Account not found");
  }
  if (account.archivedAt) {
    throw badRequest("Cannot use an archived account");
  }
  return account;
}

export async function resolveActiveCategory(
  prisma: PrismaClient,
  userId: string,
  categoryId: string,
): Promise<Category> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw notFound("Category not found");
  }
  if (category.archivedAt) {
    throw badRequest("Cannot use an archived category");
  }
  return category;
}
