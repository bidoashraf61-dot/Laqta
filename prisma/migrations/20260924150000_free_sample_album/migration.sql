-- Free sample album (owner decision 2026-09-24). ADDITIVE ONLY: one column
-- with a default and two new tables. Nothing is dropped or altered, so it is
-- safe on the shared development database while other branches add their own.

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "isHouse" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SampleAlbum" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SampleClip" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SampleAlbum_albumId_key" ON "SampleAlbum"("albumId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SampleClip_sampleId_orderIndex_idx" ON "SampleClip"("sampleId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SampleClip_sampleId_clipId_key" ON "SampleClip"("sampleId", "clipId");

-- AddForeignKey
ALTER TABLE "SampleAlbum" ADD CONSTRAINT "SampleAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleClip" ADD CONSTRAINT "SampleClip_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "SampleAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleClip" ADD CONSTRAINT "SampleClip_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
