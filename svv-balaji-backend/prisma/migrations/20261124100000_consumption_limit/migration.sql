-- Consumption limit with Production Manager approval (client decision 24 Nov 2026)
CREATE TYPE "ConsumptionApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "production_batches"
  ADD COLUMN "expectedInputQuantity" DECIMAL(12,3),
  ADD COLUMN "consumptionVariancePercent" DECIMAL(7,2),
  ADD COLUMN "consumptionTolerancePercent" DECIMAL(5,2),
  ADD COLUMN "consumptionApproval" "ConsumptionApproval",
  ADD COLUMN "consumptionReason" TEXT,
  ADD COLUMN "consumptionDecidedById" TEXT,
  ADD COLUMN "consumptionDecidedAt" TIMESTAMP(3),
  ADD COLUMN "consumptionDecisionNote" TEXT;

ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_consumptionDecidedById_fkey"
  FOREIGN KEY ("consumptionDecidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "production_settings" (
  "id" TEXT NOT NULL,
  "consumptionTolerancePercent" DECIMAL(5,2) NOT NULL DEFAULT 2,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "production_settings_pkey" PRIMARY KEY ("id")
);
