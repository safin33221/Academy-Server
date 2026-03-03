-- CreateTable
CREATE TABLE "batch_class_attendances" (
    "id" TEXT NOT NULL,
    "batchClassId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_class_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoomMeeting" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "joinUrl" TEXT NOT NULL,
    "startUrl" TEXT NOT NULL,
    "password" TEXT,
    "hostEmail" TEXT,
    "settings" JSONB,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchClassId" TEXT,

    CONSTRAINT "ZoomMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_attendances" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantZoomId" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "email" TEXT,
    "user_id" TEXT,
    "joinTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "registrantId" TEXT,

    CONSTRAINT "zoom_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_recordings" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "playUrl" TEXT,
    "fileSize" INTEGER,
    "recordingStart" TIMESTAMP(3) NOT NULL,
    "recordingEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoom_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoom_registrations" (
    "id" TEXT NOT NULL,
    "registrantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zoom_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batch_class_attendances_batchClassId_attendanceId_key" ON "batch_class_attendances"("batchClassId", "attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoomMeeting_meetingId_key" ON "ZoomMeeting"("meetingId");

-- CreateIndex
CREATE INDEX "zoom_attendances_meetingId_idx" ON "zoom_attendances"("meetingId");

-- CreateIndex
CREATE INDEX "zoom_attendances_user_id_idx" ON "zoom_attendances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_attendances_meetingId_participantZoomId_joinTime_key" ON "zoom_attendances"("meetingId", "participantZoomId", "joinTime");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_recordings_recordingId_key" ON "zoom_recordings"("recordingId");

-- CreateIndex
CREATE INDEX "zoom_recordings_meetingId_idx" ON "zoom_recordings"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_registrations_registrantId_key" ON "zoom_registrations"("registrantId");

-- CreateIndex
CREATE UNIQUE INDEX "zoom_registrations_meetingId_userId_key" ON "zoom_registrations"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "batch_class_attendances" ADD CONSTRAINT "batch_class_attendances_batchClassId_fkey" FOREIGN KEY ("batchClassId") REFERENCES "BatchClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_class_attendances" ADD CONSTRAINT "batch_class_attendances_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "zoom_attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoomMeeting" ADD CONSTRAINT "ZoomMeeting_batchClassId_fkey" FOREIGN KEY ("batchClassId") REFERENCES "BatchClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_attendances" ADD CONSTRAINT "zoom_attendances_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ZoomMeeting"("meetingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_attendances" ADD CONSTRAINT "zoom_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_recordings" ADD CONSTRAINT "zoom_recordings_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ZoomMeeting"("meetingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_registrations" ADD CONSTRAINT "zoom_registrations_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ZoomMeeting"("meetingId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoom_registrations" ADD CONSTRAINT "zoom_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
