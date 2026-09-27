-- DEV-60: offers get dates. `priceStandard` becomes the REGULAR price and the
-- sale price moves to `offerPrice`. Existing offers keep what buyers see:
-- before, priceStandard was the charged price and compareAtPrice the regular.

-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "offerEndsAt" TIMESTAMP(3),
ADD COLUMN     "offerPrice" DECIMAL(10,2),
ADD COLUMN     "offerStartsAt" TIMESTAMP(3);

-- Carry existing offers over.
UPDATE "Album"
SET "offerPrice" = "priceStandard",
    "priceStandard" = "compareAtPrice"
WHERE "compareAtPrice" IS NOT NULL;

-- AlterTable
ALTER TABLE "Album" DROP COLUMN "compareAtPrice";
