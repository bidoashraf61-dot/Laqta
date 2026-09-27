-- CreateEnum
CREATE TYPE "AlbumResolution" AS ENUM ('sd720', 'hd1080', 'uhd4k');

-- CreateEnum
CREATE TYPE "FootageStyle" AS ENUM ('live_action', 'animated_3d', 'animated_2d');

-- CreateEnum
CREATE TYPE "QualityLevel" AS ENUM ('standard', 'good', 'exceptional');

-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "footageStyle" "FootageStyle",
ADD COLUMN     "qualityLevel" "QualityLevel",
ADD COLUMN     "recommendedNote" TEXT,
ADD COLUMN     "recommendedPrice" DECIMAL(10,2),
ADD COLUMN     "resolution" "AlbumResolution";

