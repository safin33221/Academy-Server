-- CreateEnum
CREATE TYPE "ClassType" AS ENUM ('LIVE', 'RECORDED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BatchClass" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "classNumber" INTEGER NOT NULL,
    "classDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "videoId" TEXT,
    "type" "ClassType" NOT NULL DEFAULT 'RECORDED',
    "status" "ClassStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchClass_slug_key" ON "BatchClass"("slug");

-- CreateIndex
CREATE INDEX "BatchClass_batchId_idx" ON "BatchClass"("batchId");

-- CreateIndex
CREATE INDEX "BatchClass_status_idx" ON "BatchClass"("status");

-- AddForeignKey
ALTER TABLE "BatchClass" ADD CONSTRAINT "BatchClass_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
