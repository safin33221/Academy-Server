-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('OPEN', 'CLOSED', 'UPCOMING');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "certificateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discountPrice" DOUBLE PRECISION,
ADD COLUMN     "durationInWeeks" INTEGER,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "enrollmentEnd" TIMESTAMP(3),
ADD COLUMN     "enrollmentStart" TIMESTAMP(3),
ADD COLUMN     "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'UPCOMING',
ADD COLUMN     "maxStudents" INTEGER,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT,
ADD COLUMN     "seatsFilled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
