-- DEV-64b: edited interface copy (landing, /sell, FAQ, email) on top of messages/*.json.

-- CreateTable
CREATE TABLE "CopyOverride" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CopyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyRevision" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "note" TEXT,
    "restoredFromBatchId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "CopyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyPreview" (
    "id" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CopyOverride_key_locale_key" ON "CopyOverride"("key", "locale");

-- CreateIndex
CREATE INDEX "CopyRevision_batchId_idx" ON "CopyRevision"("batchId");

-- CreateIndex
CREATE INDEX "CopyRevision_publishedAt_idx" ON "CopyRevision"("publishedAt");

-- CreateIndex
CREATE INDEX "CopyPreview_createdAt_idx" ON "CopyPreview"("createdAt");

