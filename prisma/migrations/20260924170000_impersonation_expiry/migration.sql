-- Support view-as-user (2026-09-24): every impersonation expires.
--
-- Additive only. `expiresAt` is the hard stop set when a view starts;
-- `endReason` says whether the admin ended it or the clock did.

-- AlterTable
ALTER TABLE "Impersonation" ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "endReason" TEXT;
