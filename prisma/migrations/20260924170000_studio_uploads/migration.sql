-- Studio uploads: creator clip upload + release document scans.
-- ADDITIVE ONLY: one enum value and nullable columns. Nothing is dropped or
-- rewritten, so it is safe on the shared development database.

-- AlterEnum
ALTER TYPE "IngestStatus" ADD VALUE IF NOT EXISTS 'uploading' BEFORE 'uploaded';

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "ingestError" TEXT;
ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "sizeBytes" BIGINT;
ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "Clip" ADD COLUMN IF NOT EXISTS "uploadId" TEXT;

-- AlterTable
ALTER TABLE "Release" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "Release" ADD COLUMN IF NOT EXISTS "fileMime" TEXT;
ALTER TABLE "Release" ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER;
ALTER TABLE "Release" ADD COLUMN IF NOT EXISTS "fileUploadedAt" TIMESTAMP(3);
