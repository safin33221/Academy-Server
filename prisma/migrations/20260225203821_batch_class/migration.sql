/*
  Warnings:

  - The values [DRAFT,PUBLISHED,CANCELLED] on the enum `ClassStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `classDate` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `classNumber` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `BatchClass` table. All the data in the column will be lost.
  - You are about to drop the column `videoId` on the `BatchClass` table. All the data in the column will be lost.
  - Added the required column `instructorId` to the `BatchClass` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `BatchClass` table without a default value. This is not possible if the table is not empty.
  - Made the column `duration` on table `BatchClass` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ClassStatus_new" AS ENUM ('UPCOMING', 'ONGOING', 'ENDED');
ALTER TABLE "public"."BatchClass" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BatchClass" ALTER COLUMN "status" TYPE "ClassStatus_new" USING ("status"::text::"ClassStatus_new");
ALTER TYPE "ClassStatus" RENAME TO "ClassStatus_old";
ALTER TYPE "ClassStatus_new" RENAME TO "ClassStatus";
DROP TYPE "public"."ClassStatus_old";
ALTER TABLE "BatchClass" ALTER COLUMN "status" SET DEFAULT 'UPCOMING';
COMMIT;

-- DropForeignKey
ALTER TABLE "BatchClass" DROP CONSTRAINT "BatchClass_batchId_fkey";

-- DropIndex
DROP INDEX "BatchClass_batchId_idx";

-- DropIndex
DROP INDEX "BatchClass_slug_key";

-- DropIndex
DROP INDEX "BatchClass_status_idx";

-- AlterTable
ALTER TABLE "BatchClass" DROP COLUMN "classDate",
DROP COLUMN "classNumber",
DROP COLUMN "isActive",
DROP COLUMN "isDeleted",
DROP COLUMN "slug",
DROP COLUMN "type",
DROP COLUMN "videoId",
ADD COLUMN     "classStatus" "ClassType" NOT NULL DEFAULT 'LIVE',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "instructorId" TEXT NOT NULL,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "zoomJoinUrl" TEXT,
ADD COLUMN     "zoomMeetingId" TEXT,
ADD COLUMN     "zoomStartUrl" TEXT,
ALTER COLUMN "duration" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'UPCOMING';

-- AddForeignKey
ALTER TABLE "BatchClass" ADD CONSTRAINT "BatchClass_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
