-- Packs coming back from an undelivered order are quarantined until QC: never
-- straight back into sellable stock. Additive.
ALTER TYPE "StockMovementType" ADD VALUE 'UNDELIVERED_QUARANTINE';
ALTER TYPE "StockMovementType" ADD VALUE 'QUARANTINE_RELEASE';

ALTER TABLE "finished_goods_stock" ADD COLUMN "quarantineQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "finished_goods_stock" ADD CONSTRAINT "fg_stock_quarantine_non_negative" CHECK ("quarantineQuantity" >= 0);
