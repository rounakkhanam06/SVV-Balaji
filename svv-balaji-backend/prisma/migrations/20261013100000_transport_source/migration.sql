-- Transport source for supplier deliveries and farmer collections (client clarification):
-- the goods come in on a supplier's vehicle, a transporter registered with us, or (collections
-- only) the farmer's own vehicle. New Transporter master with optional insurance. The vehicle
-- and driver of each trip stay on the trip record.

-- CreateEnum
CREATE TYPE "TransportSource" AS ENUM ('SUPPLIER', 'TRANSPORTER', 'FARMER');

-- AlterTable
ALTER TABLE "raw_material_collections" ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "transportSource" "TransportSource",
ADD COLUMN     "transportSupplierId" TEXT,
ADD COLUMN     "transporterId" TEXT,
ADD COLUMN     "vehicleNumber" TEXT;

-- AlterTable
ALTER TABLE "supplier_transports" ADD COLUMN     "transportSource" "TransportSource" NOT NULL DEFAULT 'SUPPLIER',
ADD COLUMN     "transportSupplierId" TEXT,
ADD COLUMN     "transporterId" TEXT;

-- Existing deliveries came in on the delivering supplier's own vehicle.
UPDATE "supplier_transports" SET "transportSupplierId" = "supplierId" WHERE "transportSupplierId" IS NULL;

-- CreateTable
CREATE TABLE "transporters" (
    "id" TEXT NOT NULL,
    "transporterCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "panNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "insuranceValidUntil" DATE,
    "insuranceDocumentUrl" TEXT,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transporters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transporters_transporterCode_key" ON "transporters"("transporterCode");

-- CreateIndex
CREATE INDEX "transporters_isActive_idx" ON "transporters"("isActive");

-- CreateIndex
CREATE INDEX "transporters_phone_idx" ON "transporters"("phone");

-- CreateIndex
CREATE INDEX "raw_material_collections_transporterId_idx" ON "raw_material_collections"("transporterId");

-- CreateIndex
CREATE INDEX "supplier_transports_transporterId_idx" ON "supplier_transports"("transporterId");

-- AddForeignKey
ALTER TABLE "raw_material_collections" ADD CONSTRAINT "raw_material_collections_transportSupplierId_fkey" FOREIGN KEY ("transportSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_collections" ADD CONSTRAINT "raw_material_collections_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "transporters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transports" ADD CONSTRAINT "supplier_transports_transportSupplierId_fkey" FOREIGN KEY ("transportSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transports" ADD CONSTRAINT "supplier_transports_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "transporters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transporters" ADD CONSTRAINT "transporters_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
