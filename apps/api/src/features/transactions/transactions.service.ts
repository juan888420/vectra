import { badRequest, notFound } from "../../lib/http-errors.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import { resolveActiveAccount, resolveActiveCategory } from "../../lib/resource-guards.js";
import type {
  Category,
  Prisma,
  PrismaClient,
  Transaction,
  TransactionType,
} from "../../generated/prisma/client.js";
import type {
  CreateTransactionBody,
  ListTransactionsQuery,
  UpdateTransactionBody,
} from "./transactions.schemas.js";

// Prisma returns `amount` as a Decimal instance; the API responds with a
// plain number (Decimal(12,2) values stay well within float precision).
type PublicTransaction = Omit<Transaction, "amount"> & { amount: number };

function toPublic(transaction: Transaction): PublicTransaction {
  return { ...transaction, amount: Number(transaction.amount) };
}

// A Transaction has no `userId` column (only `accountId`/`categoryId`), so
// ownership goes through the account relation instead of `findOwnedOrFail`.
async function findOwnedTransactionOrFail(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Transaction> {
  const transaction = await prisma.transaction.findFirst({ where: { id, account: { userId } } });
  if (!transaction) {
    throw notFound("Transaction not found");
  }
  return transaction;
}

function assertTypeMatchesCategory(type: TransactionType, category: Category): void {
  if (type !== category.type) {
    throw badRequest(`Transaction type must match the category's type (${category.type})`);
  }
}

export async function listTransactions(
  prisma: PrismaClient,
  userId: string,
  query: ListTransactionsQuery,
): Promise<{ data: PublicTransaction[]; meta: PageMeta }> {
  const where: Prisma.TransactionWhereInput = {
    account: { userId },
    ...(query.accountId && { accountId: query.accountId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.type && { type: query.type }),
    ...((query.dateFrom || query.dateTo) && {
      date: {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      },
    }),
    ...(query.search && { note: { contains: query.search, mode: "insensitive" } }),
  };

  const [totalItems, data] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: data.map(toPublic), meta: buildMeta(query, totalItems) };
}

export async function getTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicTransaction> {
  return toPublic(await findOwnedTransactionOrFail(prisma, userId, id));
}

export async function createTransaction(
  prisma: PrismaClient,
  userId: string,
  input: CreateTransactionBody,
): Promise<PublicTransaction> {
  const account = await resolveActiveAccount(prisma, userId, input.accountId);
  const category = await resolveActiveCategory(prisma, userId, input.categoryId);
  assertTypeMatchesCategory(input.type, category);

  const transaction = await prisma.transaction.create({
    data: {
      accountId: account.id,
      categoryId: category.id,
      amount: input.amount,
      currency: account.currency,
      type: input.type,
      date: new Date(input.date),
      note: input.note,
    },
  });

  return toPublic(transaction);
}

export async function updateTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateTransactionBody,
): Promise<PublicTransaction> {
  const existing = await findOwnedTransactionOrFail(prisma, userId, id);

  // Re-resolving (and re-validating "not archived") only applies to
  // account/category actually being changed here; touching an existing
  // transaction whose account or category was archived afterwards is not
  // "selecting" a new archived resource, so it stays editable.
  const account =
    input.accountId && input.accountId !== existing.accountId
      ? await resolveActiveAccount(prisma, userId, input.accountId)
      : null;

  const typeOrCategoryChanged =
    (input.categoryId && input.categoryId !== existing.categoryId) || input.type !== undefined;
  const category = typeOrCategoryChanged
    ? await resolveActiveCategory(prisma, userId, input.categoryId ?? existing.categoryId)
    : null;

  if (category) {
    assertTypeMatchesCategory(input.type ?? existing.type, category);
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(account && { accountId: account.id, currency: account.currency }),
      ...(input.categoryId && { categoryId: input.categoryId }),
      ...(input.type && { type: input.type }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.date && { date: new Date(input.date) }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });

  return toPublic(transaction);
}

// Hard delete is a temporary MVP decision, not a definitive domain rule: the
// data model (RFC-0006) never designates Transaction as archivable, unlike
// Account/Category (business rule 3). Once budgets/reports depend on
// historical transactions, revisit this — soft-delete (or blocking deletes
// past a grace period) will likely replace it.
export async function deleteTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedTransactionOrFail(prisma, userId, id);
  await prisma.transaction.delete({ where: { id } });
}
