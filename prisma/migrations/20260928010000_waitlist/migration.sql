-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "source" TEXT NOT NULL DEFAULT 'landing',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentText" TEXT NOT NULL,
    "ipHash" TEXT,
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "launchNotifiedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_unsubscribeToken_key" ON "WaitlistEntry"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "WaitlistEntry_unsubscribedAt_createdAt_idx" ON "WaitlistEntry"("unsubscribedAt", "createdAt");


-- Move the old list (CmsEntry rows `landing_copy` / `waitlist:<email>`) across,
-- then remove them. Their consent wording was the form's own, before a consent
-- line existed — recorded as such.
INSERT INTO "WaitlistEntry" ("id", "email", "locale", "source", "consentAt", "consentText", "unsubscribeToken", "createdAt", "updatedAt")
SELECT 'wl_' || md5(random()::text || c."id"), lower(c."bodyAr"), 'ar', 'landing', c."createdAt", 'legacy-form', md5(random()::text || clock_timestamp()::text || c."id"), c."createdAt", CURRENT_TIMESTAMP
FROM "CmsEntry" c
WHERE c."kind" = 'landing_copy' AND c."slug" LIKE 'waitlist:%' AND c."bodyAr" LIKE '%@%'
ON CONFLICT ("email") DO NOTHING;

DELETE FROM "CmsEntry" WHERE "kind" = 'landing_copy' AND "slug" LIKE 'waitlist:%';
