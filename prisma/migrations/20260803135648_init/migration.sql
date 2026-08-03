-- CreateEnum
CREATE TYPE "Role" AS ENUM ('buyer', 'creator', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending_verification');

-- CreateEnum
CREATE TYPE "BillingEntityType" AS ENUM ('individual', 'business');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('pending', 'approved', 'suspended', 'rejected');

-- CreateEnum
CREATE TYPE "CreatorTier" AS ENUM ('standard', 'silver', 'gold');

-- CreateEnum
CREATE TYPE "AlbumStatus" AS ENUM ('draft', 'in_review', 'changes_requested', 'live', 'paused', 'delisted');

-- CreateEnum
CREATE TYPE "AlbumTier" AS ENUM ('mini', 'standard', 'pro', 'signature');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('full', 'editorial_only', 'pending');

-- CreateEnum
CREATE TYPE "LicenceTier" AS ENUM ('standard', 'extended');

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('model', 'property', 'permit');

-- CreateEnum
CREATE TYPE "ReleaseVerification" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('uploaded', 'probing', 'transcoding', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('unassigned', 'assigned', 'in_progress', 'approved', 'changes_requested', 'rejected');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('approve', 'request_changes', 'reject');

-- CreateEnum
CREATE TYPE "CheckState" AS ENUM ('pending', 'pass', 'fail', 'not_applicable');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('sale', 'refund', 'adjustment', 'payout', 'withholding');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('requested', 'approved', 'processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('iban', 'payoneer', 'wise');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('dmca', 'ip_claim', 'takedown', 'content_complaint');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'investigating', 'content_disabled', 'resolved', 'rejected');

-- CreateEnum
CREATE TYPE "ZatcaStatus" AS ENUM ('not_reported', 'reported', 'cleared', 'failed');

-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('category', 'location', 'tag', 'theme');

-- CreateEnum
CREATE TYPE "PromoKind" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "CmsKind" AS ENUM ('blog_post', 'help_article', 'landing_copy', 'legal');

-- CreateEnum
CREATE TYPE "CmsStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "role" "Role" NOT NULL DEFAULT 'buyer',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "billingEntityType" "BillingEntityType" NOT NULL DEFAULT 'individual',
    "legalName" TEXT,
    "crNumber" TEXT,
    "vatNumber" TEXT,
    "billingAddress" JSONB,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PhoneOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayNameAr" TEXT NOT NULL,
    "displayNameEn" TEXT NOT NULL,
    "bioAr" TEXT,
    "bioEn" TEXT,
    "showreelUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'EG',
    "city" TEXT,
    "status" "CreatorStatus" NOT NULL DEFAULT 'pending',
    "tier" "CreatorTier" NOT NULL DEFAULT 'standard',
    "commissionRateOverride" DECIMAL(5,4),
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'iban',
    "iban" TEXT,
    "bankName" TEXT,
    "beneficiaryName" TEXT,
    "payoneerEmail" TEXT,
    "wiseEmail" TEXT,
    "taxResidency" TEXT,
    "withholdingRate" DECIMAL(5,4),
    "taxFormOnFile" BOOLEAN NOT NULL DEFAULT false,
    "lifetimeGmv" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceHeld" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceAvail" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "status" "AlbumStatus" NOT NULL DEFAULT 'draft',
    "tier" "AlbumTier" NOT NULL DEFAULT 'standard',
    "priceStandard" DECIMAL(10,2) NOT NULL,
    "priceExtended" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "coverClipId" TEXT,
    "trailerUrl" TEXT,
    "clipCount" INTEGER NOT NULL DEFAULT 0,
    "totalRuntimeS" INTEGER NOT NULL DEFAULT 0,
    "totalSizeBytes" BIGINT NOT NULL DEFAULT 0,
    "clearanceStatus" "ClearanceStatus" NOT NULL DEFAULT 'pending',
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "clearedForCommercial" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featureRank" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "delistedAt" TIMESTAMP(3),
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" DECIMAL(3,2),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "licenceVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "durationS" DECIMAL(8,3) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fps" DECIMAL(6,3) NOT NULL,
    "codec" TEXT,
    "bitrateKbps" INTEGER,
    "colourProfile" TEXT,
    "aspectRatio" TEXT,
    "camera" TEXT,
    "lens" TEXT,
    "hasPeople" BOOLEAN NOT NULL DEFAULT false,
    "identifiableFaces" BOOLEAN NOT NULL DEFAULT false,
    "cameraMovement" TEXT,
    "shotSize" TEXT,
    "timeOfDay" TEXT,
    "season" TEXT,
    "locationId" TEXT,
    "geoLat" DECIMAL(9,6),
    "geoLng" DECIMAL(9,6),
    "masterKey" TEXT,
    "proxyKey" TEXT,
    "previewHlsKey" TEXT,
    "thumbnailKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spriteKey" TEXT,
    "checksum" TEXT,
    "perceptualHash" TEXT,
    "ingestStatus" "IngestStatus" NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "subjectName" TEXT,
    "authority" TEXT,
    "referenceNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "notes" TEXT,
    "verification" "ReleaseVerification" NOT NULL DEFAULT 'pending',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseClip" (
    "releaseId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,

    CONSTRAINT "ReleaseClip_pkey" PRIMARY KEY ("releaseId","clipId")
);

-- CreateTable
CREATE TABLE "Taxonomy" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "synonymsAr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "synonymsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heroImage" TEXT,
    "seoTitleAr" TEXT,
    "seoTitleEn" TEXT,
    "seoDescAr" TEXT,
    "seoDescEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumTaxonomy" (
    "albumId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,

    CONSTRAINT "AlbumTaxonomy_pkey" PRIMARY KEY ("albumId","taxonomyId")
);

-- CreateTable
CREATE TABLE "ClipTaxonomy" (
    "clipId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,

    CONSTRAINT "ClipTaxonomy_pkey" PRIMARY KEY ("clipId","taxonomyId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "heroMedia" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAlbum" (
    "collectionId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionAlbum_pkey" PRIMARY KEY ("collectionId","albumId")
);

-- CreateTable
CREATE TABLE "MerchandisingSlot" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "titleAr" TEXT,
    "titleEn" TEXT,
    "subtitleAr" TEXT,
    "subtitleEn" TEXT,
    "mediaUrl" TEXT,
    "linkUrl" TEXT,
    "ctaLabelAr" TEXT,
    "ctaLabelEn" TEXT,
    "payload" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchandisingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardClip" (
    "boardId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardClip_pkey" PRIMARY KEY ("boardId","clipId")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "licenceTier" "LicenceTier" NOT NULL DEFAULT 'standard',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "gatewayRef" TEXT,
    "billingEntitySnapshot" JSONB,
    "poNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "licenceTier" "LicenceTier" NOT NULL,
    "licenceVersionId" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "creatorNetAmount" DECIMAL(12,2) NOT NULL,
    "commissionBasis" JSONB,
    "clipManifestSnapshot" JSONB NOT NULL,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "licenceTier" "LicenceTier" NOT NULL,
    "clipIdsSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clipId" TEXT,
    "isAlbumZip" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "tier" "LicenceTier" NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenceCertificate" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "pdfKey" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "previousHash" TEXT,
    "qrCode" TEXT,
    "xmlKey" TEXT,
    "pdfKey" TEXT,
    "zatcaStatus" "ZatcaStatus" NOT NULL DEFAULT 'not_reported',
    "zatcaResponse" JSONB,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "policyBasis" TEXT NOT NULL,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "processedById" TEXT,
    "gatewayRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundLine" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "commissionReversed" DECIMAL(12,2) NOT NULL,
    "creatorNetReversed" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "RefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chargeback" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reasonCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueBy" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorLedger" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "orderItemId" TEXT,
    "payoutId" TEXT,
    "memo" TEXT,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "runId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'requested',
    "method" "PayoutMethod" NOT NULL,
    "destinationSnapshot" JSONB,
    "withholdingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "invoiceKey" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRun" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payoutCount" INTEGER NOT NULL DEFAULT 0,
    "exportKeys" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'unassigned',
    "checklist" JSONB,
    "notes" TEXT,
    "decisionNote" TEXT,
    "decision" "ReviewDecision",
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "duplicateReport" JSONB,
    "technicalReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBand" (
    "id" TEXT NOT NULL,
    "tier" "AlbumTier" NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "minClips" INTEGER NOT NULL,
    "maxClips" INTEGER,
    "priceStandard" DECIMAL(10,2) NOT NULL,
    "extendedMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL DEFAULT 'percent',
    "value" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "minOrderTotal" DECIMAL(10,2),
    "albumIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "type" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "albumId" TEXT,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantOrg" TEXT,
    "statement" TEXT NOT NULL,
    "evidenceKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affectedClipIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeId" TEXT,
    "resolution" TEXT,
    "contentDisabledAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "counterNotice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "filtersJson" JSONB,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntry" (
    "id" TEXT NOT NULL,
    "kind" "CmsKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'draft',
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "bodyEn" TEXT,
    "excerptAr" TEXT,
    "excerptEn" TEXT,
    "heroImage" TEXT,
    "seoTitleAr" TEXT,
    "seoTitleEn" TEXT,
    "seoDescAr" TEXT,
    "seoDescEn" TEXT,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impersonation" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ticketRef" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "Impersonation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "PhoneOtp_phone_expiresAt_idx" ON "PhoneOtp"("phone", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Creator_status_tier_idx" ON "Creator"("status", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");

-- CreateIndex
CREATE INDEX "Album_status_publishedAt_idx" ON "Album"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Album_creatorId_status_idx" ON "Album"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Album_isFeatured_featureRank_idx" ON "Album"("isFeatured", "featureRank");

-- CreateIndex
CREATE UNIQUE INDEX "Clip_slug_key" ON "Clip"("slug");

-- CreateIndex
CREATE INDEX "Clip_albumId_orderIndex_idx" ON "Clip"("albumId", "orderIndex");

-- CreateIndex
CREATE INDEX "Clip_perceptualHash_idx" ON "Clip"("perceptualHash");

-- CreateIndex
CREATE INDEX "Clip_locationId_idx" ON "Clip"("locationId");

-- CreateIndex
CREATE INDEX "Release_creatorId_type_verification_idx" ON "Release"("creatorId", "type", "verification");

-- CreateIndex
CREATE INDEX "Taxonomy_kind_parentId_sortOrder_idx" ON "Taxonomy"("kind", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Taxonomy_kind_slug_key" ON "Taxonomy"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MerchandisingSlot_key_key" ON "MerchandisingSlot"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Board_shareToken_key" ON "Board"("shareToken");

-- CreateIndex
CREATE INDEX "Board_userId_idx" ON "Board"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_albumId_key" ON "CartItem"("cartId", "albumId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_creatorId_createdAt_idx" ON "OrderItem"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_albumId_idx" ON "OrderItem"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_orderItemId_key" ON "Entitlement"("orderItemId");

-- CreateIndex
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_userId_albumId_licenceTier_key" ON "Entitlement"("userId", "albumId", "licenceTier");

-- CreateIndex
CREATE INDEX "Download_entitlementId_createdAt_idx" ON "Download"("entitlementId", "createdAt");

-- CreateIndex
CREATE INDEX "Download_userId_createdAt_idx" ON "Download"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceVersion_version_key" ON "LicenceVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceCertificate_orderItemId_key" ON "LicenceCertificate"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceCertificate_certificateNumber_key" ON "LicenceCertificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_uuid_key" ON "Invoice"("uuid");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_orderId_key" ON "Chargeback"("orderId");

-- CreateIndex
CREATE INDEX "CreatorLedger_creatorId_createdAt_idx" ON "CreatorLedger"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorLedger_creatorId_availableAt_idx" ON "CreatorLedger"("creatorId", "availableAt");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_creatorId_status_idx" ON "Payout"("creatorId", "status");

-- CreateIndex
CREATE INDEX "ReviewTask_status_slaDueAt_idx" ON "ReviewTask"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "ReviewTask_albumId_createdAt_idx" ON "ReviewTask"("albumId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBand_tier_key" ON "PriceBand"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_normalized_createdAt_idx" ON "SearchQueryLog"("normalized", "createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_resultCount_createdAt_idx" ON "SearchQueryLog"("resultCount", "createdAt");

-- CreateIndex
CREATE INDEX "CmsEntry_kind_status_idx" ON "CmsEntry"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntry_kind_slug_key" ON "CmsEntry"("kind", "slug");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Impersonation_adminId_startedAt_idx" ON "Impersonation"("adminId", "startedAt");

-- CreateIndex
CREATE INDEX "Impersonation_targetUserId_startedAt_idx" ON "Impersonation"("targetUserId", "startedAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_licenceVersionId_fkey" FOREIGN KEY ("licenceVersionId") REFERENCES "LicenceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Taxonomy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseClip" ADD CONSTRAINT "ReleaseClip_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseClip" ADD CONSTRAINT "ReleaseClip_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Taxonomy" ADD CONSTRAINT "Taxonomy_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Taxonomy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumTaxonomy" ADD CONSTRAINT "AlbumTaxonomy_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumTaxonomy" ADD CONSTRAINT "AlbumTaxonomy_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipTaxonomy" ADD CONSTRAINT "ClipTaxonomy_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipTaxonomy" ADD CONSTRAINT "ClipTaxonomy_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAlbum" ADD CONSTRAINT "CollectionAlbum_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAlbum" ADD CONSTRAINT "CollectionAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClip" ADD CONSTRAINT "BoardClip_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardClip" ADD CONSTRAINT "BoardClip_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_licenceVersionId_fkey" FOREIGN KEY ("licenceVersionId") REFERENCES "LicenceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenceCertificate" ADD CONSTRAINT "LicenceCertificate_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorLedger" ADD CONSTRAINT "CreatorLedger_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorLedger" ADD CONSTRAINT "CreatorLedger_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorLedger" ADD CONSTRAINT "CreatorLedger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntry" ADD CONSTRAINT "CmsEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impersonation" ADD CONSTRAINT "Impersonation_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impersonation" ADD CONSTRAINT "Impersonation_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
