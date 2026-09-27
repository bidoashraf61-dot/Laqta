-- DEV-64a: published versions of the long-form pages (Terms, Privacy, …).
-- Append-only; no row for a page means the text in content/legal.ts.

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "note" TEXT,
    "restoredFromId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersion_docKey_publishedAt_idx" ON "DocumentVersion"("docKey", "publishedAt");

