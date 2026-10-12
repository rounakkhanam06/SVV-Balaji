-- Support settings (helpline, WhatsApp, email, hours, address, FAQs) were kept in API
-- memory and reset to defaults on every restart. One persisted row now.

-- CreateTable
CREATE TABLE "support_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_settings_pkey" PRIMARY KEY ("id")
);
