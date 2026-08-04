-- CreateTable
CREATE TABLE "AlbumStat" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "boardAdds" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumStat_creatorId_day_idx" ON "AlbumStat"("creatorId", "day");

-- CreateIndex
CREATE INDEX "AlbumStat_day_idx" ON "AlbumStat"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumStat_albumId_day_key" ON "AlbumStat"("albumId", "day");

-- AddForeignKey
ALTER TABLE "AlbumStat" ADD CONSTRAINT "AlbumStat_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumStat" ADD CONSTRAINT "AlbumStat_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
