-- CreateEnum: frequencies for the scenario domain (ADR-0005). Two enums
-- rather than one shared: weekly pay is common, weekly subscriptions are not,
-- and coupling them would force every future change on one onto the other.
CREATE TYPE "ExpenseItemFrequency" AS ENUM ('MONTHLY', 'YEARLY', 'ONE_TIME');
CREATE TYPE "IncomeFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME');

-- CreateTable: reusable expense items. `categoryId` is NOT NULL — an item
-- always belongs to exactly one category (ADR-0005).
CREATE TABLE "expense_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "frequency" "ExpenseItemFrequency" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: incomes, independent of scenarios.
CREATE TABLE "incomes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "frequency" "IncomeFrequency" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_items_userId_idx" ON "expense_items"("userId");
CREATE INDEX "expense_items_categoryId_idx" ON "expense_items"("categoryId");
CREATE INDEX "incomes_userId_idx" ON "incomes"("userId");

-- AddForeignKey: the category is Restrict, since a category with items is
-- archived and never deleted (business rule 3). The user cascades like every
-- other user-owned resource.
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
