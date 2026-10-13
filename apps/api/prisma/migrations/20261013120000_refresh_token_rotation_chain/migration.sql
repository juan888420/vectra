-- Links each rotated refresh token to the one that replaced it, so refresh
-- can tell a rotation (reuse detection + a short grace window for
-- concurrent tabs) from a logout. Additive and nullable: tokens rotated
-- before this migration simply read as revoked without a successor.

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "replacedById" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replacedById_key" ON "refresh_tokens"("replacedById");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

