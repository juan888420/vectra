import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { Account, PrismaClient } from "../../generated/prisma/client.js";
import type {
  CreateAccountBody,
  ListAccountsQuery,
  UpdateAccountBody,
} from "./accounts.schemas.js";

async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  // Uniqueness applies to active accounts only, matching categories.
  const duplicate = await prisma.account.findFirst({
    where: {
      userId,
      archivedAt: null,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict(`An active account named "${name}" already exists`);
  }
}

export async function listAccounts(
  prisma: PrismaClient,
  userId: string,
  query: ListAccountsQuery,
): Promise<{ data: Account[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.type && { type: query.type }),
    ...(query.includeArchived ? {} : { archivedAt: null }),
  };

  const [totalItems, data] = await prisma.$transaction([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data, meta: buildMeta(query, totalItems) };
}

export async function getAccount(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Account> {
  return findOwnedOrFail(prisma.account, id, userId, "Account");
}

export async function createAccount(
  prisma: PrismaClient,
  userId: string,
  input: CreateAccountBody,
): Promise<Account> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // Single currency per user in the MVP (business rule 9). The column is
  // per-account so multi-currency (roadmap Phase 3) needs no schema change.
  if (input.currency && input.currency !== user.defaultCurrency) {
    throw badRequest(`MVP supports a single currency per user; expected ${user.defaultCurrency}`);
  }

  await assertNameAvailable(prisma, userId, input.name);

  return prisma.account.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      currency: input.currency ?? user.defaultCurrency,
    },
  });
}

export async function updateAccount(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateAccountBody,
): Promise<Account> {
  await findOwnedOrFail(prisma.account, id, userId, "Account");
  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }
  return prisma.account.update({ where: { id }, data: input });
}

export async function archiveAccount(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Account> {
  const account = await findOwnedOrFail(prisma.account, id, userId, "Account");

  if (account.archivedAt) {
    return account;
  }

  return prisma.account.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function unarchiveAccount(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Account> {
  const account = await findOwnedOrFail(prisma.account, id, userId, "Account");

  if (!account.archivedAt) {
    return account;
  }

  await assertNameAvailable(prisma, userId, account.name, id);

  return prisma.account.update({ where: { id }, data: { archivedAt: null } });
}

export async function deleteAccount(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.account, id, userId, "Account");

  // Entities with history are archived, never deleted (business rule 3).
  const counts = await prisma.account.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { transactions: true, recurringTransactions: true } } },
  });

  if (counts._count.transactions > 0 || counts._count.recurringTransactions > 0) {
    throw conflict("Account has associated records; archive it instead");
  }

  await prisma.account.delete({ where: { id } });
}
