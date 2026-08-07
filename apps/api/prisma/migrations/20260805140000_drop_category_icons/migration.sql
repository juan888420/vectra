-- Reverts 20260803120000_add_category_icon and
-- 20260804120000_add_scenario_item_category_icon. The scenario composer now
-- navigates categories by name chips instead of icons, and product cards show
-- the category as a colored badge whose color is derived from the name on the
-- client — so nothing about a category's appearance is stored any more.
--
-- Destructive on purpose: the icon choices are dropped, not archived. They
-- carry no financial meaning (an icon never moved a total, which is why
-- syncCategoryIconInScenarios pushed changes without asking), so there is
-- nothing to preserve for auditing.
ALTER TABLE "scenario_items" DROP COLUMN "categoryIcon";

ALTER TABLE "categories" DROP COLUMN "icon";
