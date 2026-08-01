-- AlterTable
ALTER TABLE "scenarios" ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- CreateTable
CREATE TABLE "scenario_category_watches" (
    "id" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_category_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenario_category_watches_categoryId_idx" ON "scenario_category_watches"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_category_watches_scenarioId_categoryId_key" ON "scenario_category_watches"("scenarioId", "categoryId");

-- AddForeignKey
ALTER TABLE "scenario_category_watches" ADD CONSTRAINT "scenario_category_watches_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_category_watches" ADD CONSTRAINT "scenario_category_watches_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
