-- Payout runs (batching + per-rail export). ADDITIVE ONLY: three nullable
-- columns on the existing PayoutRun table. Nothing is dropped or altered, so it
-- is safe on the shared development database while other branches add their own.

-- AlterTable
ALTER TABLE "PayoutRun" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "PayoutRun" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "PayoutRun" ADD COLUMN IF NOT EXISTS "paidById" TEXT;
