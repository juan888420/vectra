-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_items" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "expenseItemId" UUID NOT NULL,
    "addedViaCategoryId" UUID,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_compositions" (
    "id" UUID NOT NULL,
    "parentScenarioId" UUID NOT NULL,
    "includedScenarioId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_incomes" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "incomeId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenarios_userId_idx" ON "scenarios"("userId");

-- CreateIndex
CREATE INDEX "scenario_items_expenseItemId_idx" ON "scenario_items"("expenseItemId");

-- CreateIndex
CREATE INDEX "scenario_items_addedViaCategoryId_idx" ON "scenario_items"("addedViaCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_items_scenarioId_expenseItemId_key" ON "scenario_items"("scenarioId", "expenseItemId");

-- CreateIndex
CREATE INDEX "scenario_compositions_includedScenarioId_idx" ON "scenario_compositions"("includedScenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_compositions_parentScenarioId_includedScenarioId_key" ON "scenario_compositions"("parentScenarioId", "includedScenarioId");

-- CreateIndex
CREATE INDEX "scenario_incomes_incomeId_idx" ON "scenario_incomes"("incomeId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_incomes_scenarioId_incomeId_key" ON "scenario_incomes"("scenarioId", "incomeId");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_items" ADD CONSTRAINT "scenario_items_expenseItemId_fkey" FOREIGN KEY ("expenseItemId") REFERENCES "expense_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_compositions" ADD CONSTRAINT "scenario_compositions_parentScenarioId_fkey" FOREIGN KEY ("parentScenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_compositions" ADD CONSTRAINT "scenario_compositions_includedScenarioId_fkey" FOREIGN KEY ("includedScenarioId") REFERENCES "scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_incomes" ADD CONSTRAINT "scenario_incomes_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_incomes" ADD CONSTRAINT "scenario_incomes_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "incomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
