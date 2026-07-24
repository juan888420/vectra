-- AlterTable
ALTER TABLE "categories" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the per-user default "Sin categorizar" categories created before
-- this column existed (dev seed / early registrations).
UPDATE "categories" SET "isSystem" = true WHERE "name" = 'Sin categorizar';
