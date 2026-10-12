-- "How this is made" link (YouTube, Instagram, anything) on products and recipes,
-- shown to customers and retailers on the product page.

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "howItsMadeUrl" TEXT;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "howItsMadeUrl" TEXT;
