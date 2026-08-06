import { toMonthlyEquivalent, toProjection } from "@vectra/utils";

import { badRequest, conflict, notFound } from "../../lib/http-errors.js";
import { findOwnedOrFail } from "../../lib/ownership.js";
import { buildMeta, toSkipTake, type PageMeta } from "../../lib/pagination.js";
import type { ScenarioImpactChange } from "../../lib/schemas.js";
import type {
  Category,
  ExpenseItem,
  ExpenseItemFrequency,
  Income,
  Prisma,
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

export type ExpenseItemWithCategory = ExpenseItem & { category: Category };

// A scenario whose ScenarioItem/ScenarioIncome would move if a pending
// financial edit gets synced — direct owner or a composition ancestor,
// always non-archived (see the reconcile/sync functions below).
export interface AffectedScenario {
  id: string;
  name: string;
}

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
  frequency?: ExpenseItemFrequency,
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
      frequency: frequency ?? expenseItem.frequency,
      frequencyOverride: frequency !== undefined,
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
  return Promise.all(
    compositions.map(async (composition) => ({
      id: composition.id,
      childScenarioId: composition.childScenarioId,
      childScenarioName: composition.childScenario.name,
      // Same semantics as an item/income's `outdated` flag: this composed
      // scenario itself has unsynced financial drift. No detail here on
      // purpose — that still lives behind opening the child scenario.
      outdated: await hasPendingFinancialChanges(prisma, userId, composition.childScenario),
    })),
  );
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
  // Pinned on purpose (frequencyOverride) — never drift, or every sync path
  // would silently overwrite the user's chosen frequency back to the source's.
  if (!item.frequencyOverride && item.frequency !== expenseItem.frequency) {
    kinds.push("frequencyChanged");
  }
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

interface ChangeDetectorContext {
  prisma: PrismaClient;
  rootId: string;
  scenarioIds: string[];
  scenarioNames: Map<string, string>;
}

// The extensibility point: each entry inspects one concern and returns its
// own ScenarioChange[]. A future detector (currency, taxes, saving goals...)
// is one more entry here, nothing else in the pipeline changes.
const CHANGE_DETECTORS: Array<(ctx: ChangeDetectorContext) => Promise<ScenarioChange[]>> = [
  (ctx) => detectItemChanges(ctx.prisma, ctx.scenarioIds, ctx.scenarioNames),
  (ctx) => detectIncomeChanges(ctx.prisma, ctx.rootId, ctx.scenarioNames),
];

export async function detectScenarioChanges(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<ScenarioChange[]> {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  const scenarioIds = await collectReachableScenarioIds(prisma, id);
  const scenarioNames = await getScenarioNameMap(prisma, scenarioIds);
  const ctx: ChangeDetectorContext = { prisma, rootId: id, scenarioIds, scenarioNames };

  const results = await Promise.all(CHANGE_DETECTORS.map((detector) => detector(ctx)));
  return results.flat();
}

// Whether `scenario` itself has any unsynced financial drift — the same
// check getScenarioSummary derives `hasUpdates` from, reused wherever only
// the boolean matters (e.g. the "Desactualizado" badge a composed scenario
// gets in its parent's list, listScenarioCompositions above). Archived
// scenarios are frozen, same reasoning as getScenarioSummary.
async function hasPendingFinancialChanges(
  prisma: PrismaClient,
  userId: string,
  scenario: Scenario,
): Promise<boolean> {
  if (scenario.status === "ARCHIVED") {
    return false;
  }
  const changes = await detectScenarioChanges(prisma, userId, scenario.id);
  return changes.some((change) => change.kind === "financial");
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

// --- "Add whole category" (ADR-0005 §7) -------------------------------------
//
// A selection helper, nothing more: adds every active product of
// `categoryId` not already in the scenario, exactly as if each had been
// picked one by one. No persistent link to the category is kept — a product
// created in it later never surfaces here on its own (deliberate: the user
// decides per-product, every time).

export async function addScenarioCategory(
  prisma: PrismaClient,
  userId: string,
  scenarioId: string,
  categoryId: string,
): Promise<{ addedCount: number }> {
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

  return { addedCount: toAdd.length };
}

// --- Summary: totals, projections, coverage and drift, all derived ---------

// Every scenario reachable from `rootId` by following "includes" edges,
// including itself — the set whose items/incomes feed the summary. Doesn't
// filter by status: an archived scenario sitting in the middle of a
// composition chain still contributes its descendants' items to the total
// (matches how the app already treated composition before this change).
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

// The mirror image of collectReachableScenarioIds: every scenario that
// includes (directly or transitively) any id in `fromIds`. Used to find
// which parent scenarios' totals would move if a financial edit gets
// synced. Doesn't stop at an archived intermediate scenario for the same
// reason collectReachableScenarioIds doesn't — a live ancestor two levels up
// must still find out about a drifted grandchild.
async function collectAncestorScenarioIds(
  prisma: PrismaClient,
  fromIds: string[],
): Promise<string[]> {
  const visited = new Set<string>(fromIds);
  const queue = [...fromIds];
  const ancestors = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const edges = await prisma.scenarioComposition.findMany({
      where: { childScenarioId: current },
      select: { parentScenarioId: true },
    });
    for (const edge of edges) {
      if (!visited.has(edge.parentScenarioId)) {
        visited.add(edge.parentScenarioId);
        ancestors.add(edge.parentScenarioId);
        queue.push(edge.parentScenarioId);
      }
    }
  }
  return [...ancestors];
}

async function resolveAffectedScenarios(
  prisma: PrismaClient,
  directOwnerIds: string[],
  { includeAncestors }: { includeAncestors: boolean },
): Promise<AffectedScenario[]> {
  const ancestorIds = includeAncestors
    ? await collectAncestorScenarioIds(prisma, directOwnerIds)
    : [];
  const allIds = [...new Set([...directOwnerIds, ...ancestorIds])];
  return prisma.scenario.findMany({
    where: { id: { in: allIds }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// --- Sync-on-write: called right after ExpenseItem/Income is saved ---------
//
// New flow (replaces the old "review changes" UI, keeping the same
// detection machinery above): the resource is always saved immediately.
// Visual fields (name, category label) sync into every live snapshot in the
// same breath, no confirmation — they never move a total. Financial fields
// (price, frequency, archived) don't: the caller (expense-items/incomes
// service) reports the scenarios this would affect *and what syncing would
// change*, and the user decides right then whether to sync them via
// syncExpenseItemScenarios/syncIncomeScenarios. Until they do, the snapshot
// stays stale on purpose — detectScenarioChanges/hasUpdates above picks it
// up next time it's asked, nothing extra to store.

export interface ScenarioImpact {
  affectedScenarios: AffectedScenario[];
  changes: ScenarioImpactChange[];
}

const NO_IMPACT: ScenarioImpact = { affectedScenarios: [], changes: [] };

// Collapses the per-snapshot diffs into one line per field. Snapshots can
// legitimately disagree on the old value (scenario A was synced at 80.000
// while B still sits at 60.000), and inventing a single "from" would be a
// lie, so that case reports `from: null` and the dialog shows only the
// destination.
function collapseFrom<T>(values: Set<T>): T | null {
  return values.size === 1 ? ([...values][0] as T) : null;
}

function summarizeItemImpact(
  rows: ScenarioItem[],
  expenseItem: ExpenseItemWithCategory,
): ScenarioImpactChange[] {
  const base = { name: expenseItem.name, source: "expenseItem" as const };

  if (expenseItem.archivedAt) {
    return [{ ...base, field: "archived" }];
  }

  const amountFroms = new Set<number>();
  const frequencyFroms = new Set<ExpenseItem["frequency"]>();

  for (const row of rows) {
    for (const kind of diffItemKinds(row, expenseItem)) {
      if (kind === "priceChanged") amountFroms.add(Number(row.amount));
      if (kind === "frequencyChanged") frequencyFroms.add(row.frequency);
    }
  }

  const changes: ScenarioImpactChange[] = [];
  if (amountFroms.size > 0) {
    changes.push({
      ...base,
      field: "amount",
      currency: expenseItem.currency,
      from: collapseFrom(amountFroms),
      to: Number(expenseItem.amount),
    });
  }
  if (frequencyFroms.size > 0) {
    changes.push({
      ...base,
      field: "frequency",
      from: collapseFrom(frequencyFroms),
      to: expenseItem.frequency,
    });
  }
  return changes;
}

function summarizeIncomeImpact(rows: ScenarioIncome[], income: Income): ScenarioImpactChange[] {
  const base = { name: income.name, source: "income" as const };

  if (income.archivedAt) {
    return [{ ...base, field: "archived" }];
  }

  const amountFroms = new Set<number>();
  const frequencyFroms = new Set<Income["frequency"]>();

  for (const row of rows) {
    for (const kind of diffIncomeKinds(row, income)) {
      if (kind === "amountChanged") amountFroms.add(Number(row.amount));
      if (kind === "frequencyChanged") frequencyFroms.add(row.frequency);
    }
  }

  const changes: ScenarioImpactChange[] = [];
  if (amountFroms.size > 0) {
    changes.push({
      ...base,
      field: "amount",
      currency: income.currency,
      from: collapseFrom(amountFroms),
      to: Number(income.amount),
    });
  }
  if (frequencyFroms.size > 0) {
    changes.push({
      ...base,
      field: "frequency",
      from: collapseFrom(frequencyFroms),
      to: income.frequency,
    });
  }
  return changes;
}

// Turns a kept ScenarioChange (the field-by-field detector behind
// detectScenarioChanges/GET /scenarios/:id/changes, RFC-0023.1) into the
// exact same ScenarioImpactChange shape summarizeItemImpact/
// summarizeIncomeImpact produce, so a scenario's own pending-changes list
// (getScenarioSummary, below) and the post-edit dialog are described by the
// one function on the frontend — never two implementations. Visual changes
// never reach here in practice (the caller filters to `kind: "financial"`
// first, since renames sync inline at edit time and rarely drift), but the
// switch stays exhaustive so a future ScenarioChange variant fails the
// build here instead of silently vanishing from the summary.
function toScenarioImpactChange(change: ScenarioChange): ScenarioImpactChange | null {
  switch (change.type) {
    case "ITEM_PRICE_CHANGED":
      return {
        name: change.itemName,
        source: "expenseItem",
        field: "amount",
        currency: change.currency,
        from: change.from,
        to: change.to,
      };
    case "ITEM_FREQUENCY_CHANGED":
      return {
        name: change.itemName,
        source: "expenseItem",
        field: "frequency",
        from: change.from,
        to: change.to,
      };
    case "ITEM_ARCHIVED":
      return { name: change.itemName, source: "expenseItem", field: "archived" };
    case "INCOME_AMOUNT_CHANGED":
      return {
        name: change.incomeName,
        source: "income",
        field: "amount",
        currency: change.currency,
        from: change.from,
        to: change.to,
      };
    case "INCOME_FREQUENCY_CHANGED":
      return {
        name: change.incomeName,
        source: "income",
        field: "frequency",
        from: change.from,
        to: change.to,
      };
    case "INCOME_ARCHIVED":
      return { name: change.incomeName, source: "income", field: "archived" };
    case "ITEM_RENAMED":
    case "ITEM_CATEGORY_RENAMED":
    case "INCOME_RENAMED":
      return null;
  }
}

// Called right after a Category rename. A category only ever carries display
// data (unlike ExpenseItem/Income), so this drift is never financial — it
// always syncs immediately, for every live ScenarioItem snapshot under it, no
// confirmation needed.
export async function syncCategoryNameInScenarios(
  prisma: PrismaClient,
  categoryId: string,
  categoryName: string,
): Promise<void> {
  await prisma.scenarioItem.updateMany({
    where: {
      expenseItem: { categoryId },
      scenario: { status: { not: "ARCHIVED" } },
      categoryName: { not: categoryName },
    },
    data: { categoryName },
  });
}

export async function reconcileExpenseItemScenarios(
  prisma: PrismaClient,
  expenseItem: ExpenseItemWithCategory,
): Promise<ScenarioImpact> {
  const rows = await prisma.scenarioItem.findMany({
    where: { expenseItemId: expenseItem.id },
    include: { scenario: true },
  });

  const visualUpdates: Prisma.PrismaPromise<unknown>[] = [];
  const financialOwnerIds = new Set<string>();
  const financialRows: ScenarioItem[] = [];

  for (const row of rows) {
    if (row.scenario.status === "ARCHIVED") continue;

    const kinds = diffItemKinds(row, expenseItem);
    const isVisual = kinds.includes("renamed") || kinds.includes("categoryRenamed");
    const isFinancial = kinds.some((kind) => kind !== "renamed" && kind !== "categoryRenamed");

    if (isVisual) {
      visualUpdates.push(
        prisma.scenarioItem.update({
          where: { id: row.id },
          data: {
            name: expenseItem.name,
            categoryName: expenseItem.category.name,
          },
        }),
      );
    }
    if (isFinancial) {
      financialOwnerIds.add(row.scenarioId);
      financialRows.push(row);
    }
  }

  if (visualUpdates.length > 0) {
    await prisma.$transaction(visualUpdates);
  }
  if (financialOwnerIds.size === 0) {
    return NO_IMPACT;
  }

  // Items ARE inherited through composition (ADR-0005 §9): a parent's total
  // moves too, so it needs to know.
  const affectedScenarios = await resolveAffectedScenarios(prisma, [...financialOwnerIds], {
    includeAncestors: true,
  });
  return { affectedScenarios, changes: summarizeItemImpact(financialRows, expenseItem) };
}

// The "Actualizar ahora" action for a single product: re-detects (never
// trusts a client-held list — same caution as applyScenarioChanges) and
// fully syncs every live ScenarioItem whose price/frequency/archived status
// still disagrees with the source. An archived source leaves the selection
// outright, same as buildApplyOperation's ITEM_ARCHIVED case.
export async function syncExpenseItemScenarios(
  prisma: PrismaClient,
  userId: string,
  expenseItemId: string,
): Promise<{ syncedCount: number }> {
  const expenseItem = await prisma.expenseItem.findFirst({
    where: { id: expenseItemId, userId },
    include: { category: true },
  });
  if (!expenseItem) {
    throw notFound("Expense item not found");
  }

  const rows = await prisma.scenarioItem.findMany({
    where: { expenseItemId, scenario: { status: { not: "ARCHIVED" } } },
  });

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const row of rows) {
    const kinds = diffItemKinds(row, expenseItem);
    const isFinancial = kinds.some((kind) => kind !== "renamed" && kind !== "categoryRenamed");
    if (!isFinancial) continue;

    ops.push(
      expenseItem.archivedAt
        ? prisma.scenarioItem.delete({ where: { id: row.id } })
        : prisma.scenarioItem.update({
            where: { id: row.id },
            data: {
              name: expenseItem.name,
              categoryName: expenseItem.category.name,
              amount: expenseItem.amount,
              // A pinned frequency is never drift (diffItemKinds already
              // excludes it above), so a sync triggered by the price alone
              // must not overwrite it back to the source's.
              frequency: row.frequencyOverride ? row.frequency : expenseItem.frequency,
              lastSyncedAt: now,
            },
          }),
    );
  }

  if (ops.length === 0) {
    return { syncedCount: 0 };
  }
  await prisma.$transaction(ops);
  return { syncedCount: ops.length };
}

export async function reconcileIncomeScenarios(
  prisma: PrismaClient,
  income: Income,
): Promise<ScenarioImpact> {
  const rows = await prisma.scenarioIncome.findMany({
    where: { incomeId: income.id },
    include: { scenario: true },
  });

  const visualUpdates: Prisma.PrismaPromise<unknown>[] = [];
  const financialOwnerIds = new Set<string>();
  const financialRows: ScenarioIncome[] = [];

  for (const row of rows) {
    if (row.scenario.status === "ARCHIVED") continue;

    const kinds = diffIncomeKinds(row, income);
    const isVisual = kinds.includes("renamed");
    const isFinancial = kinds.some((kind) => kind !== "renamed");

    if (isVisual) {
      visualUpdates.push(
        prisma.scenarioIncome.update({ where: { id: row.id }, data: { name: income.name } }),
      );
    }
    if (isFinancial) {
      financialOwnerIds.add(row.scenarioId);
      financialRows.push(row);
    }
  }

  if (visualUpdates.length > 0) {
    await prisma.$transaction(visualUpdates);
  }
  if (financialOwnerIds.size === 0) {
    return NO_IMPACT;
  }

  // Unlike items, incomes are never inherited through composition
  // (RFC-0023.1 §9) — a parent's own coverage only ever reads its own
  // income links, never a child's, so an income change never needs to
  // propagate to an ancestor the way a price change does.
  const affectedScenarios = await resolveAffectedScenarios(prisma, [...financialOwnerIds], {
    includeAncestors: false,
  });
  return { affectedScenarios, changes: summarizeIncomeImpact(financialRows, income) };
}

// Mirrors syncExpenseItemScenarios for incomes.
export async function syncIncomeScenarios(
  prisma: PrismaClient,
  userId: string,
  incomeId: string,
): Promise<{ syncedCount: number }> {
  const income = await prisma.income.findFirst({ where: { id: incomeId, userId } });
  if (!income) {
    throw notFound("Income not found");
  }

  const rows = await prisma.scenarioIncome.findMany({
    where: { incomeId, scenario: { status: { not: "ARCHIVED" } } },
  });

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const row of rows) {
    const kinds = diffIncomeKinds(row, income);
    const isFinancial = kinds.some((kind) => kind !== "renamed");
    if (!isFinancial) continue;

    ops.push(
      income.archivedAt
        ? prisma.scenarioIncome.delete({ where: { id: row.id } })
        : prisma.scenarioIncome.update({
            where: { id: row.id },
            data: {
              name: income.name,
              amount: income.amount,
              frequency: income.frequency,
              lastSyncedAt: now,
            },
          }),
    );
  }

  if (ops.length === 0) {
    return { syncedCount: 0 };
  }
  await prisma.$transaction(ops);
  return { syncedCount: ops.length };
}

// The scenario-level "Actualizar" action: re-detects and applies every
// pending financial change reachable from this scenario in one go (its own
// items/incomes plus every composed descendant's items — the same reachable
// set the summary sums for the total), no per-item selection.
export async function syncScenario(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<{ syncedCount: number }> {
  await findOwnedOrFail(prisma.scenario, id, userId, "Scenario");
  const scenarioIds = await collectReachableScenarioIds(prisma, id);

  const items = await prisma.scenarioItem.findMany({
    where: { scenarioId: { in: scenarioIds } },
    include: { expenseItem: { include: { category: true } } },
  });
  const incomes = await prisma.scenarioIncome.findMany({
    where: { scenarioId: id },
    include: { income: true },
  });

  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const item of items) {
    const kinds = diffItemKinds(item, item.expenseItem);
    const isFinancial = kinds.some((kind) => kind !== "renamed" && kind !== "categoryRenamed");
    if (!isFinancial) continue;

    ops.push(
      item.expenseItem.archivedAt
        ? prisma.scenarioItem.delete({ where: { id: item.id } })
        : prisma.scenarioItem.update({
            where: { id: item.id },
            data: {
              name: item.expenseItem.name,
              categoryName: item.expenseItem.category.name,
              amount: item.expenseItem.amount,
              frequency: item.frequencyOverride ? item.frequency : item.expenseItem.frequency,
              lastSyncedAt: now,
            },
          }),
    );
  }

  for (const income of incomes) {
    const kinds = diffIncomeKinds(income, income.income);
    const isFinancial = kinds.some((kind) => kind !== "renamed");
    if (!isFinancial) continue;

    ops.push(
      income.income.archivedAt
        ? prisma.scenarioIncome.delete({ where: { id: income.id } })
        : prisma.scenarioIncome.update({
            where: { id: income.id },
            data: {
              name: income.income.name,
              amount: income.income.amount,
              frequency: income.income.frequency,
              lastSyncedAt: now,
            },
          }),
    );
  }

  if (ops.length === 0) {
    return { syncedCount: 0 };
  }
  await prisma.$transaction(ops);
  return { syncedCount: ops.length };
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

  // Archived scenarios are frozen: no pending state to surface, nothing to
  // sync until the user explicitly unarchives (which re-checks from
  // scratch, since this is derived and never stored). Otherwise reuses the
  // same field-level detector `syncScenario` acts on (single source of
  // truth) — a rename never flips this now that it syncs inline on save
  // (reconcileExpenseItemScenarios/reconcileIncomeScenarios); only an
  // unsynced financial change does.
  const changes =
    scenario.status === "ARCHIVED" ? [] : await detectScenarioChanges(prisma, userId, id);

  // Same list powers both: `hasUpdates` (a scenario needs the flag) and
  // `pendingChanges` (the human-readable summary shown right above the
  // "Aplicar cambios pendientes" button) — one detection pass, two views of
  // the same result, so they can never disagree with each other.
  const pendingChanges = changes
    .filter((change) => change.kind === "financial")
    .map(toScenarioImpactChange)
    .filter((change) => change !== null);

  return {
    scenario,
    totals: toProjection(monthly),
    oneTime: { items: oneTimeItems, total: oneTimeTotal },
    incomeCoverage,
    hasUpdates: pendingChanges.length > 0,
    pendingChanges,
  };
}
