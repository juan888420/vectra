-- A scenario renders its products as cards keyed by the category icon
-- (RFC-0025), and a scenario never reads the live Category (ADR-0005), so the
-- icon has to be snapshotted next to categoryName.
--
-- Added with a temporary default so existing rows are valid mid-migration; the
-- default is dropped afterwards because, unlike categories.icon, every insert
-- goes through code that always has the source category at hand — a row
-- silently defaulting to 'tag' here would be a bug, not a fallback.
ALTER TABLE "scenario_items" ADD COLUMN "categoryIcon" TEXT NOT NULL DEFAULT 'tag';

-- Backfill by join rather than by name: unlike the categories.icon migration,
-- the real category is directly reachable from the snapshot.
UPDATE "scenario_items" si
SET "categoryIcon" = c."icon"
FROM "expense_items" ei
JOIN "categories" c ON c."id" = ei."categoryId"
WHERE ei."id" = si."expenseItemId";

ALTER TABLE "scenario_items" ALTER COLUMN "categoryIcon" DROP DEFAULT;
