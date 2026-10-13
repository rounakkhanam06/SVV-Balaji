-- Referral reward trigger reduced to two options: REGISTRATION (instant on
-- signup) and FIRST_DELIVERY. Map the removed values onto the nearest survivor
-- before shrinking the enum: ACCOUNT_VERIFICATION already credited at the same
-- moment as REGISTRATION; FIRST_ORDER moves to the safer FIRST_DELIVERY.
UPDATE "referral_settings" SET "rewardTrigger" = 'REGISTRATION' WHERE "rewardTrigger" = 'ACCOUNT_VERIFICATION';
UPDATE "referral_settings" SET "rewardTrigger" = 'FIRST_DELIVERY' WHERE "rewardTrigger" = 'FIRST_ORDER';

ALTER TYPE "ReferralRewardTrigger" RENAME TO "ReferralRewardTrigger_old";
CREATE TYPE "ReferralRewardTrigger" AS ENUM ('REGISTRATION', 'FIRST_DELIVERY');
ALTER TABLE "referral_settings" ALTER COLUMN "rewardTrigger" DROP DEFAULT;
ALTER TABLE "referral_settings" ALTER COLUMN "rewardTrigger" TYPE "ReferralRewardTrigger" USING ("rewardTrigger"::text::"ReferralRewardTrigger");
ALTER TABLE "referral_settings" ALTER COLUMN "rewardTrigger" SET DEFAULT 'REGISTRATION';
DROP TYPE "ReferralRewardTrigger_old";
