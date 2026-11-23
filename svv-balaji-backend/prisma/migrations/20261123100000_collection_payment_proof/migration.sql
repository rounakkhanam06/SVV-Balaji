-- Payment evidence on farmer collections (method, reference, proof file).
ALTER TABLE "raw_material_collections"
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentDate" TIMESTAMP(3),
  ADD COLUMN "paidAmount" DECIMAL(14,2),
  ADD COLUMN "paymentProofUrl" TEXT,
  ADD COLUMN "paymentRemarks" TEXT,
  ADD COLUMN "paymentUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "paymentUpdatedById" TEXT;

ALTER TABLE "raw_material_collections"
  ADD CONSTRAINT "raw_material_collections_paymentUpdatedById_fkey"
  FOREIGN KEY ("paymentUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
