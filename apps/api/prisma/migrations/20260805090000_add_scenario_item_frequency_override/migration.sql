-- Lets a scenario pin a product's frequency instead of always tracking the
-- live ExpenseItem's (RFC-0025 cont.) — e.g. simulating an annual-billed
-- subscription in one scenario while the real product stays monthly.
-- Defaulting to false is correct forever, not just for backfill: nothing
-- before this migration could have been an intentional override, and every
-- future insert that doesn't set it explicitly (bulk "add whole category",
-- composition inheritance) is a plain copy of the source, not an override.
ALTER TABLE "scenario_items" ADD COLUMN "frequencyOverride" BOOLEAN NOT NULL DEFAULT false;
