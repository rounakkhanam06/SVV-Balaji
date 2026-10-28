-- A prepaid (online) order cancelled before dispatch refunds the gateway amount to the Refund Wallet.
ALTER TYPE "RefundWalletReason" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED_REFUND';
