-- CreateTable
CREATE TABLE "rider_cash_settlement_orders" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "gatewayOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_cash_settlement_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rider_cash_settlement_orders_gatewayOrderId_key" ON "rider_cash_settlement_orders"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "rider_cash_settlement_orders_paymentId_key" ON "rider_cash_settlement_orders"("paymentId");

-- CreateIndex
CREATE INDEX "rider_cash_settlement_orders_riderId_idx" ON "rider_cash_settlement_orders"("riderId");

-- AddForeignKey
ALTER TABLE "rider_cash_settlement_orders" ADD CONSTRAINT "rider_cash_settlement_orders_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
