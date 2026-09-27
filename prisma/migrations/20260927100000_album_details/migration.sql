-- CreateEnum
CREATE TYPE "PermitsDeclaration" AS ENUM ('none_needed', 'attached');

-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "detailsCompletedAt" TIMESTAMP(3),
ADD COLUMN     "permitsDeclaration" "PermitsDeclaration";

