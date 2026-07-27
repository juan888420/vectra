import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import { resolveActiveAccount, resolveActiveCategory } from "../../lib/resource-guards.js";
import type { PrismaClient, RecurringTransaction } from "../../generated/prisma/client.js";
import type {
  CreateRecurringTransactionBody,
  ListRecurringTransactionsQuery,
  UpdateRecurringTransactionBody,
} from "./recurring-transactions.schemas.js";

type PublicRecurringTransaction = Omit<RecurringTransaction, "amount"> & { amount: number };

function toPublic(template: RecurringTransaction): PublicRecurringTransaction {
  return { ...template, amount: Number(template.amount) };
}

const RESOURCE = "Recurring transaction";

export async function listRecurringTransactions(
  prisma: PrismaClient,
  userId: string,
  query: ListRecurringTransactionsQuery,
): Promise<{ data: PublicRecurringTransaction[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.accountId && { accountId: query.accountId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.frequency && { frequency: query.frequency }),
    ...(query.includeInactive ? {} : { isActive: true }),
  };

  const [totalItems, data] = await prisma.$transaction([
    prisma.recurringTransaction.count({ where }),
    prisma.recurringTransaction.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: data.map(toPublic), meta: buildMeta(query, totalItems) };
}

export async function getRecurringTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<PublicRecurringTransaction> {
  return toPublic(await findOwnedOrFail(prisma.recurringTransaction, id, userId, RESOURCE));
}

export async function createRecurringTransaction(
  prisma: PrismaClient,
  userId: string,
  input: CreateRecurringTransactionBody,
): Promise<PublicRecurringTransaction> {
  const account = await resolveActiveAccount(prisma, userId, input.accountId);
  // The template stores no `type`: every generated transaction takes the
  // category's type, so type consistency (business rule 2) holds by
  // construction and cannot be violated by a later category change.
  await resolveActiveCategory(prisma, userId, input.categoryId);

  const template = await prisma.recurringTransaction.create({
    data: {
      userId,
      accountId: account.id,
      categoryId: input.categoryId,
      amount: input.amount,
      currency: account.currency,
      frequency: input.frequency,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      // The first occurrence is the start date itself; the processor advances
      // it from there.
      nextExecutionDate: new Date(input.startDate),
    },
  });

  return toPublic(template);
}

export async function updateRecurringTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateRecurringTransactionBody,
): Promise<PublicRecurringTransaction> {
  const existing = await findOwnedOrFail(prisma.recurringTransaction, id, userId, RESOURCE);

  // Only a *changed* account/category is re-validated as selectable: leaving
  // one untouched on a template whose account was archived later is not a new
  // selection (same rule as transactions).
  const account =
    input.accountId && input.accountId !== existing.accountId
      ? await resolveActiveAccount(prisma, userId, input.accountId)
      : null;

  if (input.categoryId && input.categoryId !== existing.categoryId) {
    await resolveActiveCategory(prisma, userId, input.categoryId);
  }

  // A frequency change takes effect from the *next* execution onward; already
  // generated transactions are independent records (business rule 5), and
  // `nextExecutionDate` is left untouched so the pending occurrence still fires.
  const template = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      ...(account && { accountId: account.id, currency: account.currency }),
      ...(input.categoryId && { categoryId: input.categoryId }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.frequency && { frequency: input.frequency }),
      ...(input.endDate !== undefined && {
        endDate: input.endDate ? new Date(input.endDate) : null,
      }),
    },
  });

  return toPublic(template);
}

async function setActive(
  prisma: PrismaClient,
  userId: string,
  id: string,
  isActive: boolean,
): Promise<PublicRecurringTransaction> {
  const template = await findOwnedOrFail(prisma.recurringTransaction, id, userId, RESOURCE);

  if (template.isActive === isActive) {
    return toPublic(template);
  }

  return toPublic(await prisma.recurringTransaction.update({ where: { id }, data: { isActive } }));
}

// Pausing keeps `nextExecutionDate` untouched, so resuming later catches up on
// the occurrences missed while paused rather than silently dropping them.
export const pauseRecurringTransaction = (prisma: PrismaClient, userId: string, id: string) =>
  setActive(prisma, userId, id, false);

export const resumeRecurringTransaction = (prisma: PrismaClient, userId: string, id: string) =>
  setActive(prisma, userId, id, true);

// Hard delete is safe here: Transaction.recurringTransactionId is
// `onDelete: SetNull`, so deleting a template detaches the transactions it
// already generated instead of destroying financial history.
export async function deleteRecurringTransaction(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.recurringTransaction, id, userId, RESOURCE);
  await prisma.recurringTransaction.delete({ where: { id } });
}
