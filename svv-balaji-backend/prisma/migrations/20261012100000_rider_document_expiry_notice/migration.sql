-- Rider document expiry: the rider and Super Admin are told once when an approved
-- document passes its expiry date. This stamps the document so the sweep never repeats it.

-- AlterTable
ALTER TABLE "rider_documents" ADD COLUMN     "expiryNotifiedAt" TIMESTAMP(3);
