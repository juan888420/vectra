-- CreateEnum: scenario lifecycle (ADR-0005 §10). Three-way status rather
-- than a single archivedAt timestamp: ACTIVE/INACTIVE are both "alive"
-- states the user switches between, while ARCHIVED is the usual recoverable state.
CREATE TYPE "ScenarioStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable: named simulations. Totals/projections/coverage are always
-- derived from ScenarioItem/ScenarioIncome at read time, never stored here.
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: snapshot of an ExpenseItem selected into a Scenario. Frozen
-- fields (name/amount/currency/frequency/categoryName) are the historical
-- state at selection/last-sync time, and the scenario never reads the live
-- ExpenseItem for its totals (ADR-0005 principle 2).
CREATE TABLE "scenario_items" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "expenseItemId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "frequency" "ExpenseItemFrequency" NOT NULL,
    "categoryName" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: snapshot of an Income linked to a Scenario for coverage
-- calculations (ADR-0005 §15). Same snapshot reasoning as scenario_items.
CREATE TABLE "scenario_incomes" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "incomeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "frequency" "IncomeFrequency" NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: scenario-in-scenario composition (ADR-0005 §9). Cycles are
-- rejected in the service layer (BFS), not at the database level.
CREATE TABLE "scenario_compositions" (
    "id" UUID NOT NULL,
    "parentScenarioId" UUID NOT NULL,
    "childScenarioId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenarios_userId_idx" ON "scenarios"("userId");
CREATE UNIQUE INDEX "scenario_items_scenarioId_expenseItemId_key" ON "scenario_items"("scenarioId", "expenseItemId");
CREATE INDEX "scenario_items_expenseItemId_idx" ON "scenario_items"("expenseItemId");
CREATE UNIQUE INDEX "scenario_incomes_scenarioId_incomeId_key" ON "scenario_incomes"("scenarioId", "incomeId");
CREATE INDEX "scenario_incomes_incomeId_idx" ON "scenario_incomes"("incomeId");
CREATE UNIQUE INDEX "scenario_compositions_parentScenarioId_childScenarioId_key" ON "scenario_compositions"("parentScenarioId", "childScenarioId");
CREATE INDEX "scenario_compositions_childScenarioId_idx" ON "scenario_compositions"("childScenarioId");

-- AddForeignKey: scenarios cascade from the user like every other user-owned
-- resource.
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: a scenario_item disappears with its scenario, but the
-- source ExpenseItem is Restrict — it cannot be hard-deleted while any
-- scenario still references it (business rule 3, mirrored from expense_items).
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_expenseItemId_fkey" FOREIGN KEY ("expenseItemId") REFERENCES "expense_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: same reasoning as scenario_items, for incomes.
ALTER TABLE "scenario_incomes" ADD CONSTRAINT "scenario_incomes_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_incomes" ADD CONSTRAINT "scenario_incomes_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "incomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: the parent side cascades (deleting a scenario drops its own
-- composition rows). The child side is Restrict, so a scenario included
-- inside another cannot be hard-deleted out from under its parent.
ALTER TABLE "scenario_compositions" ADD CONSTRAINT "scenario_compositions_parentScenarioId_fkey" FOREIGN KEY ("parentScenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_compositions" ADD CONSTRAINT "scenario_compositions_childScenarioId_fkey" FOREIGN KEY ("childScenarioId") REFERENCES "scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
