-- Full-image banners (24 Nov 2026): one finished artwork, text fields optional.
CREATE TYPE "BannerLayout" AS ENUM ('TEXT', 'IMAGE_ONLY');
ALTER TABLE "banners" ADD COLUMN "layout" "BannerLayout" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "banners" ALTER COLUMN "description" SET DEFAULT '';
ALTER TABLE "banners" ALTER COLUMN "ctaTextPrimary" SET DEFAULT '';
ALTER TABLE "banners" ALTER COLUMN "ctaLinkPrimary" SET DEFAULT '';
