/*
  Warnings:

  - A unique constraint covering the columns `[zoomMeetingId]` on the table `BatchClass` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BatchClass_zoomMeetingId_key" ON "BatchClass"("zoomMeetingId");
