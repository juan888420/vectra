import { badRequest, conflict } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { PrismaClient, Scenario } from "../../generated/prisma/client.js";
import type {
  AddScenarioCategoryBody,
  AddScenarioCompositionBody,
  AddScenarioIncomeBody,
  AddScenarioItemBody,
  CreateScenarioBody,
  ListScenariosQuery,
  UpdateScenarioBody,
} from "./scenarios.schemas.js";

// "Reuse before duplicating" (ADR-0005) taken literally, same as ExpenseItem
// and Income: a scenario exists once per user among the non-archived ones.
async function assertNameAvailable(
  prisma: PrismaClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const duplicate = await prisma.scenario.findFirst({
    where: {
      userId,
      status: { not: "ARCHIVED" },
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  if (duplicate) {
    throw conflict(`An active scenario named "${name}" already exists`);
  }
}

// Archiving impedes entering *new* selections (business rule 3) without
// touching totals already computed elsewhere (business rule 2) — so every
// "add X to scenario" path must reject an archived X, symmetrically for
// ExpenseItem, Income and Scenario itself.
async function assertExpenseItemUsable(prisma: PrismaClient, userId: string, id: string) {
  const item = await prisma.expenseItem.findFirst({ where: { id, userId } });
  if (!item) {
    throw badRequest("Expense item not found");
  }
  if (item.archivedAt) {
    throw badRequest("Cannot add an archived expense item to a scenario");
  }
  return item;
}

async function assertIncomeUsable(prisma: PrismaClient, userId: string, id: string) {
  const income = await prisma.income.findFirst({ where: { id, userId } });
  if (!income) {
    throw badRequest("Income not found");
  }
  if (income.archivedAt) {
    throw badRequest("Cannot link an archived income to a scenario");
  }
  return income;
}

async function assertScenarioUsable(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  const scenario = await prisma.scenario.findFirst({ where: { id, userId } });
  if (!scenario) {
    throw badRequest("Scenario not found");
  }
  if (scenario.status === "ARCHIVED") {
    throw badRequest("Cannot include an archived scenario");
  }
  return scenario;
}

async function assertExpenseCategoryUsable(prisma: PrismaClient, userId: string, id: string) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    throw badRequest("Category not found");
  }
  if (category.archivedAt) {
    throw badRequest("Cannot use an archived category");
  }
  if (category.type !== "EXPENSE") {
    throw badRequest("Only expense categories can be added to a scenario");
  }
}

// Cycle guard (business rule 1): adding parent -> included must be rejected
// if included can already (transitively) reach parent, since that edge would
// close a loop. BFS over existing composition edges only — the edge being
// proposed is never in the DB yet, so this always terminates.
async function isReachable(
  prisma: PrismaClient,
  fromId: string,
  targetId: string,
): Promise<boolean> {
  const visited = new Set<string>([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const edges = await prisma.scenarioComposition.findMany({
      where: { parentScenarioId: current },
      select: { includedScenarioId: true },
    });

    for (const { includedScenarioId } of edges) {
      if (includedScenarioId === targetId) {
        return true;
      }
      if (!visited.has(includedScenarioId)) {
        visited.add(includedScenarioId);
        queue.push(includedScenarioId);
      }
    }
  }

  return false;
}

export async function listScenarios(
  prisma: PrismaClient,
  userId: string,
  query: ListScenariosQuery,
): Promise<{ data: Scenario[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.status
      ? { status: query.status }
      : !query.includeArchived && { status: { not: "ARCHIVED" as const } }),
  };

  const [totalItems, scenarios] = await prisma.$transaction([
    prisma.scenario.count({ where }),
    prisma.scenario.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data: scenarios, meta: buildMeta(query, totalItems) };
}

export async function getScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  return findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
}

export async function createScenario(
  prisma: PrismaClient,
  userId: string,
  input: CreateScenarioBody,
): Promise<Scenario> {
  await assertNameAvailable(prisma, userId, input.name);
  return prisma.scenario.create({ data: { ...input, userId } });
}

export async function updateScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateScenarioBody,
): Promise<Scenario> {
  const existing = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  if (input.name) {
    await assertNameAvailable(prisma, userId, input.name, id);
  }

  return prisma.scenario.update({ where: { id: existing.id }, data: input });
}

export async function archiveScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  if (scenario.status === "ARCHIVED") {
    return scenario;
  }

  return prisma.scenario.update({ where: { id }, data: { status: "ARCHIVED" } });
}

export async function unarchiveScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  if (scenario.status !== "ARCHIVED") {
    return scenario;
  }

  await assertNameAvailable(prisma, userId, scenario.name, id);

  return prisma.scenario.update({ where: { id }, data: { status: "ACTIVE" } });
}

// A scenario included by another cannot be deleted, only archived (business
// rule 3) — mirroring the guard ExpenseItem/Income need below.
export async function deleteScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  const includedElsewhere = await prisma.scenarioComposition.findFirst({
    where: { includedScenarioId: id },
  });
  if (includedElsewhere) {
    throw conflict("Cannot delete a scenario that another scenario includes; archive it instead");
  }

  await prisma.scenario.delete({ where: { id } });
}

export async function addScenarioItem(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  input: AddScenarioItemBody,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await assertExpenseItemUsable(prisma, userId, input.expenseItemId);

  const duplicate = await prisma.scenarioItem.findFirst({
    where: { scenarioId, expenseItemId: input.expenseItemId },
  });
  if (duplicate) {
    throw conflict("This expense item is already selected in the scenario");
  }

  return prisma.scenarioItem.create({
    data: { scenarioId, expenseItemId: input.expenseItemId, addedViaCategoryId: null },
  });
}

// "Add whole category" shortcut (ADR-0006): a snapshot of the category's
// active items right now, not a live subscription — later additions/removals
// in the category surface only as a passive notice (business rule 8).
export async function addScenarioCategory(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  input: AddScenarioCategoryBody,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await assertExpenseCategoryUsable(prisma, userId, input.categoryId);

  const activeItems = await prisma.expenseItem.findMany({
    where: { userId, categoryId: input.categoryId, archivedAt: null },
    select: { id: true },
  });
  const existing = await prisma.scenarioItem.findMany({
    where: { scenarioId, expenseItemId: { in: activeItems.map((item) => item.id) } },
    select: { expenseItemId: true },
  });
  const alreadyAdded = new Set(existing.map((item) => item.expenseItemId));
  const toAdd = activeItems.filter((item) => !alreadyAdded.has(item.id));

  if (toAdd.length === 0) {
    return { added: 0 };
  }

  await prisma.scenarioItem.createMany({
    data: toAdd.map((item) => ({
      scenarioId,
      expenseItemId: item.id,
      addedViaCategoryId: input.categoryId,
    })),
  });

  return { added: toAdd.length };
}

export async function removeScenarioItem(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  expenseItemId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await prisma.scenarioItem.deleteMany({ where: { scenarioId, expenseItemId } });
}

export async function addScenarioComposition(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  input: AddScenarioCompositionBody,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");

  if (scenarioId === input.includedScenarioId) {
    throw badRequest("A scenario cannot include itself");
  }

  await assertScenarioUsable(prisma, userId, input.includedScenarioId);

  const duplicate = await prisma.scenarioComposition.findFirst({
    where: { parentScenarioId: scenarioId, includedScenarioId: input.includedScenarioId },
  });
  if (duplicate) {
    throw conflict("This scenario is already included");
  }

  if (await isReachable(prisma, input.includedScenarioId, scenarioId)) {
    throw badRequest("Including this scenario would create a cycle");
  }

  return prisma.scenarioComposition.create({
    data: { parentScenarioId: scenarioId, includedScenarioId: input.includedScenarioId },
  });
}

export async function removeScenarioComposition(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  includedScenarioId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await prisma.scenarioComposition.deleteMany({
    where: { parentScenarioId: scenarioId, includedScenarioId },
  });
}

export async function addScenarioIncome(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  input: AddScenarioIncomeBody,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await assertIncomeUsable(prisma, userId, input.incomeId);

  const duplicate = await prisma.scenarioIncome.findFirst({
    where: { scenarioId, incomeId: input.incomeId },
  });
  if (duplicate) {
    throw conflict("This income is already linked to the scenario");
  }

  return prisma.scenarioIncome.create({ data: { scenarioId, incomeId: input.incomeId } });
}

export async function removeScenarioIncome(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  incomeId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  await prisma.scenarioIncome.deleteMany({ where: { scenarioId, incomeId } });
}

// Recursive totals (business rule 6): own MONTHLY items as-is, YEARLY
// prorated /12, ONE_TIME set aside, plus every included scenario's recurring
// total. Cycle-free by construction (business rule 1 is enforced at insert
// time), so this always terminates.
async function sumOwnItems(
  prisma: PrismaClient,
  scenarioId: string,
): Promise<{ monthly: number; oneTime: number }> {
  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId },
    include: { expenseItem: true },
  });

  let monthly = 0;
  let oneTime = 0;
  for (const { expenseItem } of items) {
    const amount = Number(expenseItem.amount);
    if (expenseItem.frequency === "MONTHLY") {
      monthly += amount;
    } else if (expenseItem.frequency === "YEARLY") {
      monthly += amount / 12;
    } else {
      oneTime += amount;
    }
  }
  return { monthly, oneTime };
}

async function sumScenarioTotals(
  prisma: PrismaClient,
  scenarioId: string,
): Promise<{ monthly: number; oneTime: number }> {
  const own = await sumOwnItems(prisma, scenarioId);
  const compositions = await prisma.scenarioComposition.findMany({
    where: { parentScenarioId: scenarioId },
    select: { includedScenarioId: true },
  });

  let monthly = own.monthly;
  let oneTime = own.oneTime;
  for (const { includedScenarioId } of compositions) {
    const included = await sumScenarioTotals(prisma, includedScenarioId);
    monthly += included.monthly;
    oneTime += included.oneTime;
  }
  return { monthly, oneTime };
}

// Coverage (business rule 7): WEEKLY normalized as amount × 52 ÷ 12, ONE_TIME
// excluded. Scoped to this scenario's own linked incomes.
async function sumIncomeMonthlyTotal(prisma: PrismaClient, scenarioId: string): Promise<number> {
  const links = await prisma.scenarioIncome.findMany({
    where: { scenarioId },
    include: { income: true },
  });

  let total = 0;
  for (const { income } of links) {
    const amount = Number(income.amount);
    if (income.frequency === "MONTHLY") {
      total += amount;
    } else if (income.frequency === "WEEKLY") {
      total += (amount * 52) / 12;
    } else if (income.frequency === "YEARLY") {
      total += amount / 12;
    }
  }
  return total;
}

export async function getScenarioTotals(prisma: PrismaClient, userId: string, id: string) {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  const { monthly, oneTime } = await sumScenarioTotals(prisma, id);
  const incomeMonthlyTotal = await sumIncomeMonthlyTotal(prisma, id);

  return {
    monthlyTotal: monthly,
    oneTimeTotal: oneTime,
    incomeMonthlyTotal,
    coveragePercent: incomeMonthlyTotal > 0 ? (monthly / incomeMonthlyTotal) * 100 : null,
  };
}

// Passive notice (business rule 8): compares what was selected at
// "add whole category" time against the category's current active items.
// Never applied automatically — the user reviews and applies per item or
// all at once.
export async function getPendingCategorySync(prisma: PrismaClient, userId: string, id: string) {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  const addedViaCategory = await prisma.scenarioItem.findMany({
    where: { scenarioId: id, addedViaCategoryId: { not: null } },
  });

  const byCategory = new Map<string, string[]>();
  for (const item of addedViaCategory) {
    const categoryId = item.addedViaCategoryId as string;
    byCategory.set(categoryId, [...(byCategory.get(categoryId) ?? []), item.expenseItemId]);
  }

  const results: { categoryId: string; addedItemIds: string[]; currentActiveItemIds: string[] }[] =
    [];

  for (const [categoryId, addedItemIds] of byCategory) {
    const currentActive = await prisma.expenseItem.findMany({
      where: { userId, categoryId, archivedAt: null },
      select: { id: true },
    });
    const currentActiveItemIds = currentActive.map((item) => item.id);

    const sameSet =
      addedItemIds.length === currentActiveItemIds.length &&
      addedItemIds.every((itemId) => currentActiveItemIds.includes(itemId));

    if (!sameSet) {
      results.push({ categoryId, addedItemIds, currentActiveItemIds });
    }
  }

  return results;
}
