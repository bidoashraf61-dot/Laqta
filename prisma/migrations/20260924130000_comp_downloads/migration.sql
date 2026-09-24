-- Watermarked-preview ("comp") downloads. Additive: one new table, no change
-- to any existing column. See CompDownload in schema.prisma.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompDownload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "clipId" TEXT,
    "isAlbumZip" BOOLEAN NOT NULL DEFAULT false,
    "fileCount" INTEGER NOT NULL DEFAULT 1,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompDownload_userId_isAlbumZip_createdAt_idx" ON "CompDownload"("userId", "isAlbumZip", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompDownload_albumId_createdAt_idx" ON "CompDownload"("albumId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CompDownload" ADD CONSTRAINT "CompDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompDownload" ADD CONSTRAINT "CompDownload_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompDownload" ADD CONSTRAINT "CompDownload_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
