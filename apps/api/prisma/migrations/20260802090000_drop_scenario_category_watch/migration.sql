-- DropForeignKey
ALTER TABLE "scenario_category_watches" DROP CONSTRAINT "scenario_category_watches_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "scenario_category_watches" DROP CONSTRAINT "scenario_category_watches_categoryId_fkey";

-- DropTable
DROP TABLE "scenario_category_watches";
