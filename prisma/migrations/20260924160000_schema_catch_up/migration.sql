-- Schema catch-up (2026-09-24).
--
-- Between `album_stats` and the 2026-09-24 feature migrations, the schema was
-- changed with `prisma db push` and never recorded here: one licence and one
-- price (the LicenceTier enum, `priceExtended`, `extendedMultiplier`), USD as
-- the default currency, bilingual creator cities, album offers, orientation,
-- origin, trailers and clip previews, reviews, footage requests and the mail
-- outbox. The development database already has all of it; a fresh database
-- built with `prisma migrate deploy` had none of it.
--
-- Generated with `prisma migrate diff --from-migrations --to-schema-datamodel`,
-- then edited once (Creator.city). `npm run verify:migrations` fails if the
-- migrations and schema.prisma drift apart again.
--
-- The drops remove the retired licence-tier columns. On a database that still
-- holds tiered orders, back up before deploying.

-- CreateEnum
CREATE TYPE "AlbumOrigin" AS ENUM ('captured', 'generated');

-- CreateEnum
CREATE TYPE "AlbumOrientation" AS ENUM ('landscape', 'portrait', 'mixed');

-- CreateEnum
CREATE TYPE "FootageRequestStatus" AS ENUM ('open', 'planned', 'fulfilled', 'declined');

-- CreateEnum
CREATE TYPE "AlbumReviewStatus" AS ENUM ('published', 'hidden');

-- DropIndex
DROP INDEX "Entitlement_userId_albumId_licenceTier_key";

-- AlterTable
ALTER TABLE "Album" DROP COLUMN "priceExtended",
ADD COLUMN     "compareAtPrice" DECIMAL(10,2),
ADD COLUMN     "offerLabelAr" TEXT,
ADD COLUMN     "offerLabelEn" TEXT,
ADD COLUMN     "orientation" "AlbumOrientation" NOT NULL DEFAULT 'landscape',
ADD COLUMN     "origin" "AlbumOrigin" NOT NULL DEFAULT 'captured',
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trailerKey" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "licenceTier";

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "previewKey" TEXT;

-- AlterTable
-- Renamed rather than dropped: `city` held the Arabic name, so any existing
-- creator keeps it as `cityAr` and only the English name starts empty.
ALTER TABLE "Creator" RENAME COLUMN "city" TO "cityAr";
ALTER TABLE "Creator" ADD COLUMN     "cityEn" TEXT;

-- AlterTable
ALTER TABLE "CreatorLedger" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Entitlement" DROP COLUMN "licenceTier";

-- AlterTable
ALTER TABLE "LicenceVersion" DROP COLUMN "tier";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "licenceTier";

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "PriceBand" DROP COLUMN "extendedMultiplier",
ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "PromoCode" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT;

-- DropEnum
DROP TYPE "LicenceTier";

-- CreateTable
CREATE TABLE "FootageRequest" (
    "id" TEXT NOT NULL,
    "briefAr" TEXT NOT NULL,
    "locationSlug" TEXT,
    "categorySlug" TEXT,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "status" "FootageRequestStatus" NOT NULL DEFAULT 'open',
    "resolutionNote" TEXT,
    "fulfilledAlbumId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumReview" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "bodyAr" TEXT,
    "status" "AlbumReviewStatus" NOT NULL DEFAULT 'published',
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailOutbox" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootageRequest_status_createdAt_idx" ON "FootageRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FootageRequest_email_idx" ON "FootageRequest"("email");

-- CreateIndex
CREATE INDEX "AlbumReview_albumId_status_createdAt_idx" ON "AlbumReview"("albumId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumReview_albumId_userId_key" ON "AlbumReview"("albumId", "userId");

-- CreateIndex
CREATE INDEX "MailOutbox_sentAt_failedAt_createdAt_idx" ON "MailOutbox"("sentAt", "failedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_albumId_key" ON "Entitlement"("userId", "albumId");

-- AddForeignKey
ALTER TABLE "FootageRequest" ADD CONSTRAINT "FootageRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

