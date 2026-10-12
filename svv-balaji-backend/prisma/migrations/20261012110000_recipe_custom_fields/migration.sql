-- Recipes: Super Admin can add extra formula fields beyond the fixed FRD 19.3 ones,
-- stored in order as [{ "label": ..., "value": ... }].

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "customFields" JSONB;
