-- AlterTable
ALTER TABLE "schemes" ADD COLUMN "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
