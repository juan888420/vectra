import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

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
import type {
  CreateScenarioBody,
  ListScenariosQuery,
  ScenarioChange,
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
): Promise<{ data: (Scenario & { monthly: number })[]; meta: PageMeta }> {
  const where = {
    userId,
    ...(query.status
      ? { status: query.status }
      : query.includeArchived
        ? {}
        : { status: { not: "ARCHIVED" as const } }),
  };

  const [totalItems, scenarios] = await prisma.$transaction([
    prisma.scenario.count({ where }),
    prisma.scenario.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      ...toSkipTake(query),
    }),
  ]);

  // "¿Cuánto cuesta?" per row (ADR-0006: Escenarios is the main, persistently
  // visible screen) — computed here, once per page, instead of one /summary
  // call per scenario from the client.
  const data = await Promise.all(
    scenarios.map(async (scenario) => ({
      ...scenario,
      monthly: await getScenarioMonthlyTotal(prisma, scenario.id),
    })),
  );

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
  // Field-level diff (see the change-review section below), not a blunt
  // `updatedAt` comparison — a category rename no longer flags this item.
  const outdated = diffItemKinds(item, expenseItem).length > 0;
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
  const outdated = diffIncomeKinds(income, source).length > 0;
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

// --- Change review (RFC-0023.1) ---------------------------------------------
//
// Every ScenarioChange is derived by comparing a frozen snapshot against its
// live source — never stored. `kind: "visual"` changes (a rename) apply the
// instant the review panel opens, no confirmation: they never move a total.
// `kind: "financial"` changes stay listed until the user checks them and
// confirms (ADR-0005/0006: Vectra never modifies a scenario silently).
//
// To add a new change type later (currency, taxes, discounts, saving
// goals...): add the schema variant in scenarios.schemas.ts, add one
// `diff*Kinds`/`to*Change` branch below (or a whole new sibling pair for a
// new concern, pushed into `CHANGE_DETECTORS`), and one case in
// `buildApplyOperation`. The routes, the apply endpoint and the review
// dialog never need to change — everything flows through the same
// `id`/`kind`/apply pipeline regardless of type.

function scenarioChangeId(type: string, key: string): string {
  return `${type}:${key}`;
}

type ItemDiffKind =
  "archived" | "renamed" | "categoryRenamed" | "priceChanged" | "frequencyChanged";

// Pure field comparison, no DB access — the single source of truth for
// "did this item drift", shared by the per-item `outdated` flag
// (toPublicScenarioItem, above) and the full detector below, so the two can
// never disagree with each other again.
function diffItemKinds(item: ScenarioItem, expenseItem: ExpenseItemWithCategory): ItemDiffKind[] {
  if (expenseItem.archivedAt) {
    // Archived: leaving the selection is the only meaningful action: price/
    // frequency drift on the way out is moot.
    return ["archived"];
  }
  const kinds: ItemDiffKind[] = [];
  if (item.name !== expenseItem.name) kinds.push("renamed");
  if (item.categoryName !== expenseItem.category.name) kinds.push("categoryRenamed");
  if (Number(item.amount) !== Number(expenseItem.amount)) kinds.push("priceChanged");
  if (item.frequency !== expenseItem.frequency) kinds.push("frequencyChanged");
  return kinds;
}

function toItemChange(
  diffKind: ItemDiffKind,
  item: ScenarioItem,
  expenseItem: ExpenseItemWithCategory,
  origin: { id: string; name: string },
): ScenarioChange {
  const base = {
    originScenarioId: origin.id,
    originScenarioName: origin.name,
    scenarioItemId: item.id,
    expenseItemId: item.expenseItemId,
  };
  switch (diffKind) {
    case "archived":
      return {
        ...base,
        id: scenarioChangeId("ITEM_ARCHIVED", item.id),
        kind: "financial",
        type: "ITEM_ARCHIVED",
        itemName: item.name,
      };
    case "renamed":
      return {
        ...base,
        id: scenarioChangeId("ITEM_RENAMED", item.id),
        kind: "visual",
        type: "ITEM_RENAMED",
        from: item.name,
        to: expenseItem.name,
      };
    case "categoryRenamed":
      return {
        ...base,
        id: scenarioChangeId("ITEM_CATEGORY_RENAMED", item.id),
        kind: "visual",
        type: "ITEM_CATEGORY_RENAMED",
        itemName: expenseItem.name,
        from: item.categoryName,
        to: expenseItem.category.name,
      };
    case "priceChanged":
      return {
        ...base,
        id: scenarioChangeId("ITEM_PRICE_CHANGED", item.id),
        kind: "financial",
        type: "ITEM_PRICE_CHANGED",
        itemName: expenseItem.name,
        currency: expenseItem.currency,
        from: Number(item.amount),
        to: Number(expenseItem.amount),
      };
    case "frequencyChanged":
      return {
        ...base,
        id: scenarioChangeId("ITEM_FREQUENCY_CHANGED", item.id),
        kind: "financial",
        type: "ITEM_FREQUENCY_CHANGED",
        itemName: expenseItem.name,
        from: item.frequency,
        to: expenseItem.frequency,
      };
  }
}

type IncomeDiffKind = "archived" | "renamed" | "amountChanged" | "frequencyChanged";

function diffIncomeKinds(income: ScenarioIncome, source: Income): IncomeDiffKind[] {
  if (source.archivedAt) {
    return ["archived"];
  }
  const kinds: IncomeDiffKind[] = [];
  if (income.name !== source.name) kinds.push("renamed");
  if (Number(income.amount) !== Number(source.amount)) kinds.push("amountChanged");
  if (income.frequency !== source.frequency) kinds.push("frequencyChanged");
  return kinds;
}

function toIncomeChange(
  diffKind: IncomeDiffKind,
  income: ScenarioIncome,
  source: Income,
  origin: { id: string; name: string },
): ScenarioChange {
  const base = {
    originScenarioId: origin.id,
    originScenarioName: origin.name,
    scenarioIncomeId: income.id,
    incomeId: income.incomeId,
  };
  switch (diffKind) {
    case "archived":
      return {
        ...base,
        id: scenarioChangeId("INCOME_ARCHIVED", income.id),
        kind: "financial",
        type: "INCOME_ARCHIVED",
        incomeName: income.name,
      };
    case "renamed":
      return {
        ...base,
        id: scenarioChangeId("INCOME_RENAMED", income.id),
        kind: "visual",
        type: "INCOME_RENAMED",
        from: income.name,
        to: source.name,
      };
    case "amountChanged":
      return {
        ...base,
        id: scenarioChangeId("INCOME_AMOUNT_CHANGED", income.id),
        kind: "financial",
        type: "INCOME_AMOUNT_CHANGED",
        incomeName: source.name,
        currency: source.currency,
        from: Number(income.amount),
        to: Number(source.amount),
      };
    case "frequencyChanged":
      return {
        ...base,
        id: scenarioChangeId("INCOME_FREQUENCY_CHANGED", income.id),
        kind: "financial",
        type: "INCOME_FREQUENCY_CHANGED",
        incomeName: source.name,
        from: income.frequency,
        to: source.frequency,
      };
  }
}

async function getScenarioNameMap(
  prisma: PrismaClient,
  scenarioIds: string[],
): Promise<Map<string, string>> {
  const scenarios = await prisma.scenario.findMany({
    where: { id: { in: scenarioIds } },
    select: { id: true, name: true },
  });
  return new Map(scenarios.map((scenario) => [scenario.id, scenario.name]));
}

// Items ARE inherited through composition (ADR-0005 §9), so their drift is
// checked across every reachable scenario, attributed back to whichever one
// actually owns the row via `originScenarioId`.
async function detectItemChanges(
  prisma: PrismaClient,
  scenarioIds: string[],
  scenarioNames: Map<string, string>,
): Promise<ScenarioChange[]> {
  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId: { in: scenarioIds } },
    include: { expenseItem: { include: { category: true } } },
  });

  const changes: ScenarioChange[] = [];
  for (const item of items) {
    const origin = { id: item.scenarioId, name: scenarioNames.get(item.scenarioId) ?? "" };
    for (const diffKind of diffItemKinds(item, item.expenseItem)) {
      changes.push(toItemChange(diffKind, item, item.expenseItem, origin));
    }
  }
  return changes;
}

// Incomes are never inherited through composition (RFC-0023.1 §9), so only
// the root scenario's own links are ever relevant.
async function detectIncomeChanges(
  prisma: PrismaClient,
  rootId: string,
  scenarioNames: Map<string, string>,
): Promise<ScenarioChange[]> {
  const incomes = await prisma.scenarioIncome.findMany({
    where: { scenarioId: rootId },
    include: { income: true },
  });

  const origin = { id: rootId, name: scenarioNames.get(rootId) ?? "" };
  const changes: ScenarioChange[] = [];
  for (const income of incomes) {
    for (const diffKind of diffIncomeKinds(income, income.income)) {
      changes.push(toIncomeChange(diffKind, income, income.income, origin));
    }
  }
  return changes;
}

// Category watches are scoped to the root scenario only — same reasoning as
// incomes: a composed child's own watches are its own concern to review.
async function detectNewItemsInWatchedCategories(
  prisma: PrismaClient,
  userId: string,
  rootId: string,
  scenarioNames: Map<string, string>,
): Promise<ScenarioChange[]> {
  const watches = await prisma.scenarioCategoryWatch.findMany({
    where: { scenarioId: rootId },
    include: { category: true },
  });
  if (watches.length === 0) {
    return [];
  }

  const ownItems = await prisma.scenarioItem.findMany({
    where: { scenarioId: rootId },
    select: { expenseItemId: true },
  });
  const includedIds = new Set(ownItems.map((item) => item.expenseItemId));
  const origin = { id: rootId, name: scenarioNames.get(rootId) ?? "" };

  const changes: ScenarioChange[] = [];
  for (const watch of watches) {
    const candidates = await prisma.expenseItem.findMany({
      where: { userId, categoryId: watch.categoryId, archivedAt: null },
    });
    for (const candidate of candidates) {
      if (includedIds.has(candidate.id)) continue;
      changes.push({
        id: scenarioChangeId("NEW_ITEM_AVAILABLE", `${rootId}:${candidate.id}`),
        kind: "financial",
        type: "NEW_ITEM_AVAILABLE",
        originScenarioId: origin.id,
        originScenarioName: origin.name,
        categoryId: watch.categoryId,
        categoryName: watch.category.name,
        expenseItemId: candidate.id,
        itemName: candidate.name,
        currency: candidate.currency,
        amount: Number(candidate.amount),
        frequency: candidate.frequency,
      });
    }
  }
  return changes;
}

interface ChangeDetectorContext {
  prisma: PrismaClient;
  userId: string;
  rootId: string;
  scenarioIds: string[];
  scenarioNames: Map<string, string>;
}

// The extensibility point: each entry inspects one concern and returns its
// own ScenarioChange[]. A future detector is one more entry here, nothing
// else in the pipeline changes.
const CHANGE_DETECTORS: Array<(ctx: ChangeDetectorContext) => Promise<ScenarioChange[]>> = [
  (ctx) => detectItemChanges(ctx.prisma, ctx.scenarioIds, ctx.scenarioNames),
  (ctx) => detectIncomeChanges(ctx.prisma, ctx.rootId, ctx.scenarioNames),
  (ctx) => detectNewItemsInWatchedCategories(ctx.prisma, ctx.userId, ctx.rootId, ctx.scenarioNames),
];

export async function detectScenarioChanges(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<ScenarioChange[]> {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  const scenarioIds = await collectReachableScenarioIds(prisma, id);
  const scenarioNames = await getScenarioNameMap(prisma, scenarioIds);
  const ctx: ChangeDetectorContext = { prisma, userId, rootId: id, scenarioIds, scenarioNames };

  const results = await Promise.all(CHANGE_DETECTORS.map((detector) => detector(ctx)));
  return results.flat();
}

function buildApplyOperation(prisma: PrismaClient, change: ScenarioChange) {
  const now = new Date();
  switch (change.type) {
    case "ITEM_RENAMED":
      return prisma.scenarioItem.update({
        where: { id: change.scenarioItemId },
        data: { name: change.to, lastSyncedAt: now },
      });
    case "ITEM_CATEGORY_RENAMED":
      return prisma.scenarioItem.update({
        where: { id: change.scenarioItemId },
        data: { categoryName: change.to, lastSyncedAt: now },
      });
    case "ITEM_PRICE_CHANGED":
      return prisma.scenarioItem.update({
        where: { id: change.scenarioItemId },
        data: { amount: change.to, lastSyncedAt: now },
      });
    case "ITEM_FREQUENCY_CHANGED":
      return prisma.scenarioItem.update({
        where: { id: change.scenarioItemId },
        data: { frequency: change.to, lastSyncedAt: now },
      });
    case "ITEM_ARCHIVED":
      // Leaves the selection outright rather than staying frozen forever —
      // an archived product no longer belongs in a live simulation.
      return prisma.scenarioItem.delete({ where: { id: change.scenarioItemId } });
    case "INCOME_RENAMED":
      return prisma.scenarioIncome.update({
        where: { id: change.scenarioIncomeId },
        data: { name: change.to, lastSyncedAt: now },
      });
    case "INCOME_AMOUNT_CHANGED":
      return prisma.scenarioIncome.update({
        where: { id: change.scenarioIncomeId },
        data: { amount: change.to, lastSyncedAt: now },
      });
    case "INCOME_FREQUENCY_CHANGED":
      return prisma.scenarioIncome.update({
        where: { id: change.scenarioIncomeId },
        data: { frequency: change.to, lastSyncedAt: now },
      });
    case "INCOME_ARCHIVED":
      return prisma.scenarioIncome.delete({ where: { id: change.scenarioIncomeId } });
    case "NEW_ITEM_AVAILABLE":
      return prisma.scenarioItem.create({
        data: {
          scenarioId: change.originScenarioId,
          expenseItemId: change.expenseItemId,
          name: change.itemName,
          amount: change.amount,
          currency: change.currency,
          frequency: change.frequency,
          categoryName: change.categoryName,
        },
      });
    default: {
      // Compile-time reminder: a new schema variant without a case here
      // fails the build instead of silently doing nothing at apply time.
      const exhaustive: never = change;
      throw new Error(`Unhandled scenario change type: ${(exhaustive as ScenarioChange).type}`);
    }
  }
}

// Re-detects instead of trusting the client's `changeIds` blindly: only
// changes that are still actually present get applied, which also means
// ownership and existence are validated implicitly (detectScenarioChanges
// already scopes everything to `userId`/`id`).
export async function applyScenarioChanges(
  prisma: PrismaClient,
  userId: string,
  id: string,
  changeIds: string[],
): Promise<{ appliedCount: number }> {
  const allChanges = await detectScenarioChanges(prisma, userId, id);
  const toApply = allChanges.filter((change) => changeIds.includes(change.id));

  if (toApply.length === 0) {
    return { appliedCount: 0 };
  }

  await prisma.$transaction(toApply.map((change) => buildApplyOperation(prisma, change)));

  return { appliedCount: toApply.length };
}

// --- Category watches & "add whole category" (ADR-0005 §7 / RFC-0023.1) ----

export async function listScenarioCategoryWatches(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
) {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const watches = await prisma.scenarioCategoryWatch.findMany({
    where: { scenarioId },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  return watches.map((watch) => ({
    id: watch.id,
    categoryId: watch.categoryId,
    categoryName: watch.category.name,
  }));
}

// Adds every active product of `categoryId` not already in the scenario
// (ADR-0005 §7: a whole category as the initial selection) and starts
// watching it, so products added to the category later surface as
// NEW_ITEM_AVAILABLE instead of silently never showing up.
export async function addScenarioCategory(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  categoryId: string,
): Promise<{
  addedCount: number;
  watch: { id: string; categoryId: string; categoryName: string };
}> {
  const scenario = await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  assertNotArchived(scenario, "add a category to");

  const category = await findOwnedOrFail(prisma.category, categoryId, userId, "Category");
  if (category.archivedAt) {
    throw badRequest("Cannot add an archived category");
  }

  const [existingItems, activeExpenseItems] = await Promise.all([
    prisma.scenarioItem.findMany({ where: { scenarioId }, select: { expenseItemId: true } }),
    prisma.expenseItem.findMany({ where: { categoryId, userId, archivedAt: null } }),
  ]);
  const existingIds = new Set(existingItems.map((item) => item.expenseItemId));
  const toAdd = activeExpenseItems.filter((item) => !existingIds.has(item.id));

  const watch = await prisma.scenarioCategoryWatch.upsert({
    where: { scenarioId_categoryId: { scenarioId, categoryId } },
    create: { scenarioId, categoryId },
    update: {},
  });

  if (toAdd.length > 0) {
    await prisma.scenarioItem.createMany({
      data: toAdd.map((item) => ({
        scenarioId,
        expenseItemId: item.id,
        name: item.name,
        amount: item.amount,
        currency: item.currency,
        frequency: item.frequency,
        categoryName: category.name,
      })),
    });
  }

  return {
    addedCount: toAdd.length,
    watch: { id: watch.id, categoryId: category.id, categoryName: category.name },
  };
}

export async function removeScenarioCategoryWatch(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  watchId: string,
): Promise<void> {
  await findOwnedOrFail(prisma.scenario, scenarioId, userId, "Scenario");
  const watch = await prisma.scenarioCategoryWatch.findFirst({
    where: { id: watchId, scenarioId },
  });
  if (!watch) {
    throw notFound("Category watch not found");
  }
  await prisma.scenarioCategoryWatch.delete({ where: { id: watch.id } });
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

// Just the recurring monthly total (no coverage/hasUpdates/oneTime detail) —
// cheap enough to compute per row in `listScenarios` (see above), unlike the
// full `getScenarioSummary`.
async function getScenarioMonthlyTotal(prisma: PrismaClient, scenarioId: string): Promise<number> {
  const scenarioIds = await collectReachableScenarioIds(prisma, scenarioId);
  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId: { in: scenarioIds }, frequency: { not: "ONE_TIME" } },
    select: { amount: true, frequency: true },
  });
  return items.reduce(
    (sum, item) => sum + toMonthlyEquivalent(Number(item.amount), item.frequency),
    0,
  );
}

export async function getScenarioSummary(prisma: PrismaClient, userId: string, id: string) {
  const scenario = await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  const scenarioIds = await collectReachableScenarioIds(prisma, id);

  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId: { in: scenarioIds } },
    include: { expenseItem: { include: { category: true } } },
  });
  // Never inherited through composition (RFC-0023.1 §9): only the root
  // scenario's own income links count toward its coverage.
  const incomes = await prisma.scenarioIncome.findMany({
    where: { scenarioId: id },
    include: { income: true },
  });

  let monthly = 0;
  let oneTimeTotal = 0;
  const oneTimeItems: { id: string; name: string; amount: number }[] = [];

  for (const item of items) {
    const amount = Number(item.amount);
    if (item.frequency === "ONE_TIME") {
      oneTimeTotal += amount;
      oneTimeItems.push({ id: item.id, name: item.name, amount });
    } else {
      monthly += toMonthlyEquivalent(amount, item.frequency);
    }
  }

  let totalIncomeMonthly = 0;
  for (const income of incomes) {
    if (income.frequency !== "ONE_TIME") {
      totalIncomeMonthly += toMonthlyEquivalent(Number(income.amount), income.frequency);
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

  // Reuses the same field-level detector the review dialog calls (single
  // source of truth) — a rename never flips this, only changes that
  // actually need the user's review do (RFC-0023.1).
  const changes = await detectScenarioChanges(prisma, userId, id);

  return {
    scenario,
    totals: toProjection(monthly),
    oneTime: { items: oneTimeItems, total: oneTimeTotal },
    incomeCoverage,
    hasUpdates: changes.length > 0,
  };
}
