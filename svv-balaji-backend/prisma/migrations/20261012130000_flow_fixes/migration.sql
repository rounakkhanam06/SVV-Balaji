-- Fixes from the 12 Oct flow review:
--  * riders are reminded before an approved document expires (stamped once);
--  * recipes record expected processing loss, so ingredient input is worked out from yield correctly;
--  * every change to a recipe's "how it's made" link is logged.

-- AlterTable
ALTER TABLE "rider_documents" ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "expectedLossPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "recipe_link_logs" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "fromUrl" TEXT,
    "toUrl" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_link_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_link_logs_recipeId_createdAt_idx" ON "recipe_link_logs"("recipeId", "createdAt");

-- AddForeignKey
ALTER TABLE "recipe_link_logs" ADD CONSTRAINT "recipe_link_logs_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_link_logs" ADD CONSTRAINT "recipe_link_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
