-- Categories are navigated by icon alone in the scenario composer
-- (RFC-0025), so every category needs one. The column keeps its default so
-- existing rows backfill on ALTER and any insert omitting it stays valid.
ALTER TABLE "categories" ADD COLUMN "icon" TEXT NOT NULL DEFAULT 'tag';

-- Give the categories seeded at registration (see initial-user-data.ts) their
-- real icon instead of the generic fallback. Any category the user created
-- themselves keeps 'tag' until they edit it.
UPDATE "categories" SET "icon" = 'utensils'    WHERE "name" = 'Comida';
UPDATE "categories" SET "icon" = 'car'         WHERE "name" = 'Transporte';
UPDATE "categories" SET "icon" = 'house'       WHERE "name" = 'Vivienda';
UPDATE "categories" SET "icon" = 'heart-pulse' WHERE "name" = 'Salud';
UPDATE "categories" SET "icon" = 'gamepad-2'   WHERE "name" = 'Entretenimiento';
UPDATE "categories" SET "icon" = 'shopping-bag' WHERE "name" = 'Compras';
UPDATE "categories" SET "icon" = 'credit-card' WHERE "name" = 'Suscripciones';
UPDATE "categories" SET "icon" = 'briefcase'   WHERE "name" = 'Salario';
UPDATE "categories" SET "icon" = 'laptop'      WHERE "name" = 'Freelance';
UPDATE "categories" SET "icon" = 'banknote'    WHERE "name" = 'Otros ingresos';
