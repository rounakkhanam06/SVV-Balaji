-- Pack sizes (product variants) become real stock units end to end.
-- Additive: every existing row gets variantId NULL = "the product's own pack",
-- which is exactly what every existing order line, batch and hold already meant.

-- Weight of one pack of a given size (rider carry limit, per-kg pay).
ALTER TABLE "product_variants" ADD COLUMN "packWeightKg" DECIMAL(10,3);

-- Which pack size a finished-goods batch was packed as.
ALTER TABLE "finished_goods_batches" ADD COLUMN "variantId" TEXT;
ALTER TABLE "finished_goods_batches" ADD CONSTRAINT "finished_goods_batches_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "finished_goods_batches_productId_variantId_idx" ON "finished_goods_batches"("productId", "variantId");

-- Which pack size an order line is for.
ALTER TABLE "order_items" ADD COLUMN "variantId" TEXT;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One line per (product, pack size). A plain unique on (orderId, productId, variantId)
-- would let two NULL-variant lines through (NULLs are distinct), so COALESCE it.
DROP INDEX "order_items_orderId_productId_key";
CREATE UNIQUE INDEX "order_items_orderId_productId_variant_key"
  ON "order_items"("orderId", "productId", COALESCE("variantId", ''));

-- Which pack size a checkout hold / order reservation is for.
ALTER TABLE "stock_reservations" ADD COLUMN "variantId" TEXT;
CREATE INDEX "stock_reservations_warehouseId_variantId_idx" ON "stock_reservations"("warehouseId", "variantId");
