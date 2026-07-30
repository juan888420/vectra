import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type {
  Category,
  ExpenseItem,
  Income,
  PrismaClient,
  Scenario,
  ScenarioComposition,
  ScenarioIncome,
  ScenarioItem,
} from "../../generated/prisma/client.js";
import { toMonthlyEquivalent } from "./scenarios.projections.js";
import type {
  CreateScenarioBody,
  ListScenariosQuery,
  UpdateScenarioBody,
} from "./scenarios.schemas.js";

// "Reuse before duplicating" applies to scenario names too, mirroring
// Category/ExpenseItem/Income: two active simulations named the same would
// make comparisons ambiguous. Scoped to non-archived scenarios, same as
// elsewhere — an archived "Escenario actual" must not block a fresh one.
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
    throw conflict(`A scenario named "${name}" already exists`);
  }
}

function assertNotArchived(scenario: Scenario, action = "modify"): void {
  if (scenario.status === "ARCHIVED") {
    throw conflict(`Cannot ${action} an archived scenario`);
  }
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
      : query.includeArchived
        ? {}
        : { status: { not: "ARCHIVED" as const } }),
  };

  const [totalItems, data] = await prisma.$transaction([
    prisma.scenario.count({ where }),
    prisma.scenario.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  return { data, meta: buildMeta(query, totalItems) };
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
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  await assertNameAvailable(prisma, userId, input.name, id);
  return prisma.scenario.update({ where: { id: scenario.id }, data: input });
}

export async function activateScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  assertNotArchived(scenario, "activate");
  return prisma.scenario.update({ where: { id }, data: { status: "ACTIVE" } });
}

export async function deactivateScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<Scenario> {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  assertNotArchived(scenario, "deactivate");
  return prisma.scenario.update({ where: { id }, data: { status: "INACTIVE" } });
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

  // Restoring must not collide with a scenario created under the same name
  // since. Lands as INACTIVE, never ACTIVE: reactivating a simulation as
  // "the current situation" is a decision the user makes explicitly.
  await assertNameAvailable(prisma, userId, scenario.name, id);
  return prisma.scenario.update({ where: { id }, data: { status: "INACTIVE" } });
}

export async function deleteScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");

  // A scenario composed into another cannot be hard-deleted out from under
  // it (business rule 3 equivalent, mirroring ExpenseItem/Income). Its own
  // items/incomes/outgoing compositions cascade away with it.
  const counts = await prisma.scenario.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { includedIn: true } } },
  });
  if (counts._count.includedIn > 0) {
    throw conflict("Scenario is included in another scenario; archive it instead");
  }

  await prisma.scenario.delete({ where: { id } });
}

// --- Scenario items (ExpenseItem snapshots) ---------------------------------

type ExpenseItemWithCategory = ExpenseItem & { category: Category };

function toPublicScenarioItem(item: ScenarioItem, expenseItem: ExpenseItemWithCategory) {
  const outdated =
    expenseItem.updatedAt > item.lastSyncedAt || expenseItem.category.name !== item.categoryName;
  return {
    id: item.id,
    expenseItemId: item.expenseItemId,
    name: item.name,
    amount: Number(item.amount),
    currency: item.currency,
    frequency: item.frequency,
    categoryName: item.categoryName,
    lastSyncedAt: item.lastSyncedAt,
    outdated,
  };
}

export async function listScenarioItems(prisma: PrismaClient, userId: string, scenarioId: string) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId },
    include: { expenseItem: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  });
  return items.map((item) => toPublicScenarioItem(item, item.expenseItem));
}

export async function addScenarioItem(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  expenseItemId: string,
) {
  const scenario = await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  assertNotArchived(scenario, "add items to");

  const expenseItem = await prisma.expenseItem.findFirst({
    where: { id: expenseItemId, userId },
    include: { category: true },
  });
  if (!expenseItem) {
    throw badRequest("Expense item not found");
  }
  if (expenseItem.archivedAt) {
    throw badRequest("Cannot add an archived expense item");
  }

  const existing = await prisma.scenarioItem.findFirst({ where: { scenarioId, expenseItemId } });
  if (existing) {
    throw conflict("This expense item is already in the scenario");
  }

  const item = await prisma.scenarioItem.create({
    data: {
      scenarioId,
      expenseItemId,
      name: expenseItem.name,
      amount: expenseItem.amount,
      currency: expenseItem.currency,
      frequency: expenseItem.frequency,
      categoryName: expenseItem.category.name,
    },
  });
  return toPublicScenarioItem(item, expenseItem);
}

export async function removeScenarioItem(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  itemId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const item = await prisma.scenarioItem.findFirst({ where: { id: itemId, scenarioId } });
  if (!item) {
    throw notFound("Scenario item not found");
  }
  await prisma.scenarioItem.delete({ where: { id: item.id } });
}

// --- Scenario incomes (Income snapshots) ------------------------------------

function toPublicScenarioIncome(income: ScenarioIncome, source: Income) {
  const outdated = source.updatedAt > income.lastSyncedAt;
  return {
    id: income.id,
    incomeId: income.incomeId,
    name: income.name,
    amount: Number(income.amount),
    currency: income.currency,
    frequency: income.frequency,
    lastSyncedAt: income.lastSyncedAt,
    outdated,
  };
}

export async function listScenarioIncomes(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const incomes = await prisma.scenarioIncome.findMany({
    where: { scenarioId },
    include: { income: true },
    orderBy: { createdAt: "asc" },
  });
  return incomes.map((income) => toPublicScenarioIncome(income, income.income));
}

export async function addScenarioIncome(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  incomeId: string,
) {
  const scenario = await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  assertNotArchived(scenario, "add incomes to");

  const income = await prisma.income.findFirst({ where: { id: incomeId, userId } });
  if (!income) {
    throw badRequest("Income not found");
  }
  if (income.archivedAt) {
    throw badRequest("Cannot link an archived income");
  }

  const existing = await prisma.scenarioIncome.findFirst({ where: { scenarioId, incomeId } });
  if (existing) {
    throw conflict("This income is already linked to the scenario");
  }

  const scenarioIncome = await prisma.scenarioIncome.create({
    data: {
      scenarioId,
      incomeId,
      name: income.name,
      amount: income.amount,
      currency: income.currency,
      frequency: income.frequency,
    },
  });
  return toPublicScenarioIncome(scenarioIncome, income);
}

export async function removeScenarioIncome(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  scenarioIncomeId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const income = await prisma.scenarioIncome.findFirst({
    where: { id: scenarioIncomeId, scenarioId },
  });
  if (!income) {
    throw notFound("Scenario income not found");
  }
  await prisma.scenarioIncome.delete({ where: { id: income.id } });
}

// --- Scenario composition (scenario-in-scenario) ----------------------------

// BFS over "includes" edges (parentScenarioId = current) starting at `fromId`.
// Returns true if `toId` is reachable, i.e. `fromId` already includes `toId`
// directly or transitively.
async function reaches(prisma: PrismaClient, fromId: string, toId: string): Promise<boolean> {
  const visited = new Set<string>([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === toId) {
      return true;
    }
    const edges = await prisma.scenarioComposition.findMany({
      where: { parentScenarioId: current },
      select: { childScenarioId: true },
    });
    for (const edge of edges) {
      if (!visited.has(edge.childScenarioId)) {
        visited.add(edge.childScenarioId);
        queue.push(edge.childScenarioId);
      }
    }
  }
  return false;
}

export async function listScenarioCompositions(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const compositions = await prisma.scenarioComposition.findMany({
    where: { parentScenarioId: scenarioId },
    include: { childScenario: true },
    orderBy: { createdAt: "asc" },
  });
  return compositions.map((composition) => ({
    id: composition.id,
    childScenarioId: composition.childScenarioId,
    childScenarioName: composition.childScenario.name,
  }));
}

export async function addScenarioComposition(
  prisma: PrismaClient,
  userId: string,
  parentScenarioId: string,
  childScenarioId: string,
): Promise<ScenarioComposition> {
  const parent = await findOwnedOrFail(prisma.scenario, parentScenarioId, userId, "Scenario");
  assertNotArchived(parent, "compose");

  if (parentScenarioId === childScenarioId) {
    throw badRequest("A scenario cannot include itself");
  }

  const child = await findOwnedOrFail(prisma.scenario, childScenarioId, userId, "Scenario");
  if (child.status === "ARCHIVED") {
    throw badRequest("Cannot include an archived scenario");
  }

  const existing = await prisma.scenarioComposition.findFirst({
    where: { parentScenarioId, childScenarioId },
  });
  if (existing) {
    throw conflict("This scenario is already included");
  }

  // Adding parent -> child creates a cycle if child already (transitively)
  // includes parent (business rule: no direct or transitive cycles).
  if (await reaches(prisma, childScenarioId, parentScenarioId)) {
    throw badRequest("This composition would create a cycle");
  }

  return prisma.scenarioComposition.create({ data: { parentScenarioId, childScenarioId } });
}

export async function removeScenarioComposition(
  prisma: PrismaClient,
  userId: string,
  parentScenarioId: string,
  compositionId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, parentScenarioId, userId, "Scenario");
  const composition = await prisma.scenarioComposition.findFirst({
    where: { id: compositionId, parentScenarioId },
  });
  if (!composition) {
    throw notFound("Scenario composition not found");
  }
  await prisma.scenarioComposition.delete({ where: { id: composition.id } });
}

// --- Summary: totals, projections, coverage and drift, all derived ---------

// Every scenario reachable from `rootId` by following "includes" edges,
// including itself — the set whose items/incomes feed the summary.
async function collectReachableScenarioIds(
  prisma: PrismaClient,
  rootId: string,
): Promise<string[]> {
  const visited = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const edges = await prisma.scenarioComposition.findMany({
      where: { parentScenarioId: current },
      select: { childScenarioId: true },
    });
    for (const edge of edges) {
      if (!visited.has(edge.childScenarioId)) {
        visited.add(edge.childScenarioId);
        queue.push(edge.childScenarioId);
      }
    }
  }
  return [...visited];
}

export async function getScenarioSummary(prisma: PrismaClient, userId: string, id: string) {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  const scenarioIds = await collectReachableScenarioIds(prisma, id);

  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId: { in: scenarioIds } },
    include: { expenseItem: { include: { category: true } } },
  });
  const incomes = await prisma.scenarioIncome.findMany({
    where: { scenarioId: { in: scenarioIds } },
    include: { income: true },
  });

  let monthly = 0;
  let oneTimeTotal = 0;
  const oneTimeItems: { id: string; name: string; amount: number }[] = [];
  let hasUpdates = false;

  for (const item of items) {
    const amount = Number(item.amount);
    if (item.frequency === "ONE_TIME") {
      oneTimeTotal += amount;
      oneTimeItems.push({ id: item.id, name: item.name, amount });
    } else {
      monthly += toMonthlyEquivalent(amount, item.frequency);
    }
    if (
      item.expenseItem.updatedAt > item.lastSyncedAt ||
      item.expenseItem.category.name !== item.categoryName
    ) {
      hasUpdates = true;
    }
  }

  let totalIncomeMonthly = 0;
  for (const income of incomes) {
    if (income.frequency !== "ONE_TIME") {
      totalIncomeMonthly += toMonthlyEquivalent(Number(income.amount), income.frequency);
    }
    if (income.income.updatedAt > income.lastSyncedAt) {
      hasUpdates = true;
    }
  }

  const incomeCoverage =
    totalIncomeMonthly > 0
      ? {
          totalIncomeMonthly,
          consumedPercentage: (monthly / totalIncomeMonthly) * 100,
          remainingMonthly: totalIncomeMonthly - monthly,
        }
      : null;

  return {
    scenario,
    totals: { monthly, sixMonths: monthly * 6, twelveMonths: monthly * 12 },
    oneTime: { items: oneTimeItems, total: oneTimeTotal },
    incomeCoverage,
    hasUpdates,
  };
}
