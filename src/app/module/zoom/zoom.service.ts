import axios from "axios";
import crypto from "crypto";
import { ClassStatus, UserRole } from "@prisma/client";
import { Request } from "express";
import prisma from "../../../lib/prisma.js";
import { getZoomAccessToken } from "../../../lib/zoom.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

type ZoomWebhookResult = { statusCode: number; body: Record<string, unknown> };
type AuthUser = { id: string; role: string };
type CreateZoomMeetingPayload = { topic: string; startTime: Date | string; duration: number; batchClassId?: string };
type ParticipantEntity = {
    user_id?: string | number;
    id?: string | number;
    user_name?: string;
    name?: string;
    email?: string;
    registrant_id?: string;
    join_time?: string;
    leave_time?: string;
    duration?: number;
};

const ZOOM_SIGNATURE_VERSION = "v0";
const ZOOM_SIGNATURE_TTL_SECONDS = 300;

const toDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value;
    if (typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const calculateDurationSeconds = (joinTime: Date, leaveTime: Date | null, existingDuration: number | null) => {
    if (typeof existingDuration === "number" && existingDuration >= 0) return existingDuration;
    if (!leaveTime) return 0;
    return Math.max(0, Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000));
};

const getHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const getRawRequestBody = (req: Request) => {
    const rawBody = (req as Request & { rawBody?: string | Buffer }).rawBody;
    if (typeof rawBody === "string") return rawBody;
    if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
    return JSON.stringify(req.body ?? {});
};

const isValidSignature = (expected: string, received: string) => {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const toParticipantZoomId = (participant: ParticipantEntity): string | null => {
    const value = participant.user_id ?? participant.id;
    return value === undefined || value === null ? null : String(value);
};

const toParticipantName = (participant: ParticipantEntity): string =>
    participant.user_name?.trim() || participant.name?.trim() || "Unknown Participant";

const toParticipantEmail = (participant: ParticipantEntity): string | null => {
    if (!participant.email) return null;
    const email = participant.email.trim();
    return email || null;
};

const toRegistrantId = (participant: ParticipantEntity): string | null => {
    if (!participant.registrant_id) return null;
    const registrantId = participant.registrant_id.trim();
    return registrantId || null;
};

const getParticipantKey = (params: { userId: string | null; email: string | null; participantZoomId: string }) => {
    if (params.userId) return `user:${params.userId}`;
    if (params.email) return `email:${params.email.toLowerCase()}`;
    return `zoom:${params.participantZoomId}`;
};

const resolveBatchClassByMeetingId = async (meetingId: string) => {
    const byBatchClassMeetingId = await prisma.batchClass.findFirst({
        where: { zoomMeetingId: meetingId },
        include: { batch: { include: { _count: { select: { enrollments: true } } } } },
    });
    if (byBatchClassMeetingId) return byBatchClassMeetingId;

    const meeting = await prisma.zoomMeeting.findUnique({ where: { meetingId }, select: { batchClassId: true } });
    if (!meeting?.batchClassId) return null;

    return prisma.batchClass.findUnique({
        where: { id: meeting.batchClassId },
        include: { batch: { include: { _count: { select: { enrollments: true } } } } },
    });
};

const resolveSystemUserIdForParticipant = async (participant: ParticipantEntity): Promise<string | null> => {
    const email = toParticipantEmail(participant);
    if (email) {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (user?.id) return user.id;
    }

    const registrantId = toRegistrantId(participant);
    if (registrantId) {
        const registration = await prisma.zoomRegistration.findUnique({ where: { registrantId }, select: { userId: true } });
        if (registration?.userId) return registration.userId;
    }

    return null;
};

const createZoomMeeting = async (payload: CreateZoomMeetingPayload) => {
    const topic = payload.topic?.trim();
    const startTime = payload.startTime instanceof Date ? payload.startTime : new Date(payload.startTime);
    const duration = Number(payload.duration);

    if (!topic) throw new ApiError(httpCode.BAD_REQUEST, "Meeting topic is required");
    if (Number.isNaN(startTime.getTime())) throw new ApiError(httpCode.BAD_REQUEST, "Invalid startTime");
    if (!duration || duration <= 0) throw new ApiError(httpCode.BAD_REQUEST, "Invalid duration");

    if (payload.batchClassId) {
        const existingClass = await prisma.batchClass.findUnique({ where: { id: payload.batchClassId }, select: { id: true } });
        if (!existingClass) throw new ApiError(httpCode.NOT_FOUND, "Batch class not found");
    }

    try {
        const token = await getZoomAccessToken();
        const zoomUserId = (process.env.ZOOM_USER_ID || "me").split("#")[0].trim();

        const response = await axios.post(
            `https://api.zoom.us/v2/users/${encodeURIComponent(zoomUserId)}/meetings`,
            {
                topic,
                type: 2,
                start_time: startTime.toISOString(),
                duration,
                timezone: "Asia/Dhaka",
                settings: {
                    waiting_room: true,
                    join_before_host: false,
                    auto_recording: "cloud",
                },
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const meetingId = String(response.data.id);
        const zoomMeeting = await prisma.zoomMeeting.upsert({
            where: { meetingId },
            update: {
                topic: response.data.topic,
                startTime: new Date(response.data.start_time),
                duration: response.data.duration,
                joinUrl: response.data.join_url,
                startUrl: response.data.start_url,
                password: response.data.password || null,
                hostEmail: response.data.host_email || null,
                settings: response.data.settings ?? null,
                status: "waiting",
                batchClassId: payload.batchClassId ?? null,
            },
            create: {
                meetingId,
                topic: response.data.topic,
                startTime: new Date(response.data.start_time),
                duration: response.data.duration,
                joinUrl: response.data.join_url,
                startUrl: response.data.start_url,
                password: response.data.password || null,
                hostEmail: response.data.host_email || null,
                settings: response.data.settings ?? null,
                status: "waiting",
                batchClassId: payload.batchClassId ?? null,
            },
        });

        return { ...response.data, localMeetingId: zoomMeeting.id };
    } catch (error: any) {
        const zoomErrorPayload = error?.response?.data;
        const zoomErrorMessage = zoomErrorPayload?.message || (zoomErrorPayload ? JSON.stringify(zoomErrorPayload) : undefined);
        throw new ApiError(httpCode.BAD_REQUEST, zoomErrorMessage || error?.message || "Zoom meeting creation failed");
    }
};

const handleParticipantJoined = async (payload: any) => {
    try {
        const meetingId = payload?.object?.id ? String(payload.object.id) : null;
        const participant = (payload?.object?.participant ?? {}) as ParticipantEntity;
        if (!meetingId) return;

        const participantZoomId = toParticipantZoomId(participant);
        if (!participantZoomId) return;

        const zoomMeeting = await prisma.zoomMeeting.findUnique({ where: { meetingId }, select: { meetingId: true, actualStartTime: true } });
        if (!zoomMeeting) return;

        const joinTime = toDate(participant.join_time) || new Date();

        const existingOpenRecord = await prisma.zoomAttendance.findFirst({
            where: { meetingId, participantZoomId, leaveTime: null },
            select: { id: true },
        });
        if (existingOpenRecord) return;

        const userId = await resolveSystemUserIdForParticipant(participant);
        const email = toParticipantEmail(participant);

        const isLate =
            zoomMeeting.actualStartTime &&
            joinTime.getTime() - zoomMeeting.actualStartTime.getTime() > 10 * 60 * 1000;

        const attendance = await prisma.zoomAttendance.create({
            data: {
                meetingId,
                participantZoomId,
                participantName: toParticipantName(participant),
                email,
                userId,
                joinTime,
                status: isLate ? "LATE" : "PRESENT",
                registrantId: toRegistrantId(participant),
            },
        });

        const batchClass = await resolveBatchClassByMeetingId(meetingId);
        if (batchClass) {
            await prisma.batchClassAttendance.createMany({
                data: [{ batchClassId: batchClass.id, attendanceId: attendance.id }],
                skipDuplicates: true,
            });
        }
    } catch (error) {
        console.error("Error handling participant joined:", error);
    }
};

const handleParticipantLeft = async (payload: any) => {
    try {
        const meetingId = payload?.object?.id ? String(payload.object.id) : null;
        const participant = (payload?.object?.participant ?? {}) as ParticipantEntity;
        if (!meetingId) return;

        const participantZoomId = toParticipantZoomId(participant);
        if (!participantZoomId) return;

        const leaveTime = toDate(participant.leave_time) || new Date();
        const batchClass = await resolveBatchClassByMeetingId(meetingId);
        const classDurationSeconds = batchClass ? batchClass.duration * 60 : null;

        const openRecords = await prisma.zoomAttendance.findMany({
            where: { meetingId, participantZoomId, leaveTime: null },
            orderBy: { joinTime: "asc" },
        });
        if (!openRecords.length) return;

        await prisma.$transaction(
            openRecords.map((record) => {
                const durationSeconds = calculateDurationSeconds(record.joinTime, leaveTime, record.duration);
                const leftEarly = classDurationSeconds !== null && durationSeconds < classDurationSeconds * 0.6;
                return prisma.zoomAttendance.update({
                    where: { id: record.id },
                    data: {
                        leaveTime,
                        duration: durationSeconds,
                        status: leftEarly ? "LEFT_EARLY" : record.status,
                    },
                });
            })
        );
    } catch (error) {
        console.error("Error handling participant left:", error);
    }
};

const handleMeetingStarted = async (payload: any) => {
    try {
        const meetingId = payload?.object?.id ? String(payload.object.id) : null;
        if (!meetingId) return;

        const actualStartTime = toDate(payload?.object?.start_time) || new Date();

        await Promise.all([
            prisma.zoomMeeting.updateMany({
                where: { meetingId },
                data: { status: "started", actualStartTime },
            }),
            prisma.batchClass.updateMany({
                where: { zoomMeetingId: meetingId },
                data: { status: ClassStatus.ONGOING },
            }),
        ]);
    } catch (error) {
        console.error("Error handling meeting started:", error);
    }
};

const handleMeetingEnded = async (payload: any) => {
    try {
        const meetingId = payload?.object?.id ? String(payload.object.id) : null;
        if (!meetingId) return;

        const actualEndTime = toDate(payload?.object?.end_time) || new Date();
        const batchClass = await resolveBatchClassByMeetingId(meetingId);
        const classDurationSeconds = batchClass ? batchClass.duration * 60 : null;

        await Promise.all([
            prisma.zoomMeeting.updateMany({
                where: { meetingId },
                data: { status: "ended", actualEndTime },
            }),
            prisma.batchClass.updateMany({
                where: { zoomMeetingId: meetingId },
                data: { status: ClassStatus.ENDED },
            }),
        ]);

        const openAttendances = await prisma.zoomAttendance.findMany({ where: { meetingId, leaveTime: null } });
        if (!openAttendances.length) return;

        await prisma.$transaction(
            openAttendances.map((record) => {
                const durationSeconds = calculateDurationSeconds(record.joinTime, actualEndTime, record.duration);
                const leftEarly = classDurationSeconds !== null && durationSeconds < classDurationSeconds * 0.6;
                return prisma.zoomAttendance.update({
                    where: { id: record.id },
                    data: {
                        leaveTime: actualEndTime,
                        duration: durationSeconds,
                        status: leftEarly ? "LEFT_EARLY" : record.status,
                    },
                });
            })
        );
    } catch (error) {
        console.error("Error handling meeting ended:", error);
    }
};
const handleRecordingCompleted = async (payload: any) => {
    try {
        const meetingId = payload?.object?.id ? String(payload.object.id) : null;
        const recordingFiles = Array.isArray(payload?.object?.recording_files)
            ? payload.object.recording_files
            : [];

        if (!meetingId || !recordingFiles.length) return;

        const mp4File = recordingFiles.find(
            (file: any) => file?.file_type === "MP4" && file?.play_url
        );

        if (mp4File?.play_url) {
            await prisma.batchClass.updateMany({
                where: { zoomMeetingId: meetingId },
                data: {
                    recordingUrl: mp4File.play_url,
                    status: ClassStatus.ENDED,
                },
            });
        }

        for (const file of recordingFiles) {
            const recordingId = file?.id ? String(file.id) : null;
            if (!recordingId) continue;

            const recordingStart = toDate(file?.recording_start) || new Date();
            const recordingEnd = toDate(file?.recording_end) || recordingStart;

            await prisma.zoomRecording.upsert({
                where: { recordingId },
                update: {
                    fileType: file?.file_type ?? "UNKNOWN",
                    downloadUrl: file?.download_url ?? "",
                    playUrl: file?.play_url ?? null,
                    fileSize: typeof file?.file_size === "number" ? file.file_size : null,
                    recordingStart,
                    recordingEnd,
                },
                create: {
                    meetingId,
                    recordingId,
                    fileType: file?.file_type ?? "UNKNOWN",
                    downloadUrl: file?.download_url ?? "",
                    playUrl: file?.play_url ?? null,
                    fileSize: typeof file?.file_size === "number" ? file.file_size : null,
                    recordingStart,
                    recordingEnd,
                },
            });
        }
    } catch (error) {
        console.error("Error handling recording completed:", error);
    }
};

const getMeetingParticipants = async (meetingId: string) => {
    try {
        const token = await getZoomAccessToken();
        let nextPageToken: string | undefined;
        const participants: any[] = [];

        do {
            const response = await axios.get(
                `https://api.zoom.us/v2/metrics/meetings/${meetingId}/participants`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                        page_size: 300,
                        next_page_token: nextPageToken,
                    },
                }
            );

            const current = Array.isArray(response.data?.participants)
                ? response.data.participants
                : [];

            participants.push(...current);
            nextPageToken = response.data?.next_page_token || undefined;
        } while (nextPageToken);

        return { participants, total_records: participants.length };
    } catch (error: any) {
        const message = error?.response?.data?.message || error?.message;
        throw new ApiError(
            httpCode.BAD_REQUEST,
            message || "Failed to fetch meeting participants"
        );
    }
};

const syncAttendanceAfterMeeting = async (meetingId: string) => {
    const participantsResponse = await getMeetingParticipants(meetingId);
    const participants = Array.isArray(participantsResponse.participants)
        ? participantsResponse.participants
        : [];

    if (!participants.length) {
        return {
            message: "No participants found for sync",
            created: 0,
            updated: 0,
            linked: 0,
            skipped: 0,
        };
    }

    const batchClass = await resolveBatchClassByMeetingId(meetingId);
    let created = 0;
    let updated = 0;
    let linked = 0;
    let skipped = 0;

    for (const item of participants) {
        const participant = item as ParticipantEntity;
        const participantZoomId = toParticipantZoomId(participant);
        const joinTime = toDate(participant.join_time);

        if (!participantZoomId || !joinTime) {
            skipped += 1;
            continue;
        }

        const leaveTime = toDate(participant.leave_time);
        const userId = await resolveSystemUserIdForParticipant(participant);
        const email = toParticipantEmail(participant);

        const existing = await prisma.zoomAttendance.findUnique({
            where: {
                meetingId_participantZoomId_joinTime: {
                    meetingId,
                    participantZoomId,
                    joinTime,
                },
            },
        });

        const durationSeconds = calculateDurationSeconds(
            joinTime,
            leaveTime,
            typeof participant.duration === "number" ? participant.duration : null
        );

        const attendance = existing
            ? await prisma.zoomAttendance.update({
                where: { id: existing.id },
                data: {
                    participantName: toParticipantName(participant),
                    email,
                    userId,
                    leaveTime,
                    duration: durationSeconds,
                    status: existing.status,
                    registrantId: toRegistrantId(participant),
                },
            })
            : await prisma.zoomAttendance.create({
                data: {
                    meetingId,
                    participantZoomId,
                    participantName: toParticipantName(participant),
                    email,
                    userId,
                    joinTime,
                    leaveTime,
                    duration: durationSeconds,
                    status: "PRESENT",
                    registrantId: toRegistrantId(participant),
                },
            });

        if (existing) {
            updated += 1;
        } else {
            created += 1;
        }

        if (batchClass) {
            const inserted = await prisma.batchClassAttendance.createMany({
                data: [{ batchClassId: batchClass.id, attendanceId: attendance.id }],
                skipDuplicates: true,
            });
            linked += inserted.count;
        }
    }

    return {
        message: "Attendance synced successfully",
        created,
        updated,
        linked,
        skipped,
        total: participants.length,
    };
};

const createMeetingRegistration = async (
    meetingId: string,
    userId: string,
    email: string,
    name: string
) => {
    const existing = await prisma.zoomRegistration.findUnique({
        where: { meetingId_userId: { meetingId, userId } },
    });

    if (existing) {
        return {
            registrant_id: existing.registrantId,
            join_url: existing.joinUrl,
            alreadyRegistered: true,
        };
    }

    try {
        const token = await getZoomAccessToken();

        const response = await axios.post(
            `https://api.zoom.us/v2/meetings/${meetingId}/registrants`,
            {
                email,
                first_name: name.split(" ")[0] || "Student",
                last_name: name.split(" ").slice(1).join(" ") || "User",
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const registrant = response.data;

        await prisma.zoomRegistration.create({
            data: {
                registrantId: registrant.registrant_id,
                meetingId,
                userId,
                joinUrl: registrant.join_url || null,
            },
        });

        return registrant;
    } catch (error: any) {
        const message = error?.response?.data?.message || error?.message;
        throw new ApiError(
            httpCode.BAD_REQUEST,
            message || "Failed to create meeting registration"
        );
    }
};

const createRegistrationForUser = async (meetingId: string, userId: string) => {
    const [zoomMeeting, user] = await Promise.all([
        prisma.zoomMeeting.findUnique({ where: { meetingId }, select: { meetingId: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } }),
    ]);

    if (!zoomMeeting) {
        throw new ApiError(httpCode.NOT_FOUND, "Zoom meeting not found");
    }

    if (!user) {
        throw new ApiError(httpCode.NOT_FOUND, "User not found");
    }

    const batchClass = await resolveBatchClassByMeetingId(meetingId);
    if (batchClass) {
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
        const isInstructor = batchClass.instructorId === user.id;

        const isEnrolled = await prisma.enrollment.findUnique({
            where: {
                userId_batchId: {
                    userId: user.id,
                    batchId: batchClass.batchId,
                },
            },
            select: { id: true },
        });

        if (!isAdmin && !isInstructor && !isEnrolled) {
            throw new ApiError(httpCode.FORBIDDEN, "You are not enrolled in this class");
        }
    }

    return createMeetingRegistration(meetingId, user.id, user.email, user.name);
};

const validateMeetingAccess = async (meetingId: string, authUser: AuthUser) => {
    if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPER_ADMIN) {
        return;
    }

    const batchClass = await resolveBatchClassByMeetingId(meetingId);
    if (!batchClass) return;

    if (authUser.role === UserRole.INSTRUCTOR && batchClass.instructorId !== authUser.id) {
        throw new ApiError(httpCode.FORBIDDEN, "You are not allowed to access this meeting attendance");
    }
};

const validateBatchClassAccess = async (batchClassId: string, authUser: AuthUser) => {
    if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPER_ADMIN) {
        return;
    }

    const batchClass = await prisma.batchClass.findUnique({
        where: { id: batchClassId },
        select: { id: true, batchId: true, instructorId: true },
    });

    if (!batchClass) {
        throw new ApiError(httpCode.NOT_FOUND, "Batch class not found");
    }

    if (authUser.role === UserRole.INSTRUCTOR && batchClass.instructorId !== authUser.id) {
        throw new ApiError(httpCode.FORBIDDEN, "You are not allowed to access this class attendance");
    }

    if (authUser.role === UserRole.STUDENT) {
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                userId_batchId: {
                    userId: authUser.id,
                    batchId: batchClass.batchId,
                },
            },
            select: { id: true },
        });

        if (!enrollment) {
            throw new ApiError(httpCode.FORBIDDEN, "You are not enrolled in this batch");
        }
    }
};
const getMeetingAttendanceReport = async (meetingId: string, authUser: AuthUser) => {
    await validateMeetingAccess(meetingId, authUser);

    const zoomMeeting = await prisma.zoomMeeting.findUnique({
        where: { meetingId },
        include: {
            batchClass: {
                include: {
                    batch: {
                        include: {
                            _count: { select: { enrollments: true } },
                        },
                    },
                },
            },
        },
    });

    if (!zoomMeeting) {
        throw new ApiError(httpCode.NOT_FOUND, "Zoom meeting not found");
    }

    const attendances = await prisma.zoomAttendance.findMany({
        where: { meetingId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinTime: "asc" },
    });

    const uniqueParticipantMap = new Map<
        string,
        {
            userId: string | null;
            email: string | null;
            participantName: string;
            totalDurationSeconds: number;
        }
    >();

    for (const attendance of attendances) {
        const key = getParticipantKey({
            userId: attendance.userId,
            email: attendance.email,
            participantZoomId: attendance.participantZoomId,
        });

        const durationSeconds = calculateDurationSeconds(
            attendance.joinTime,
            attendance.leaveTime,
            attendance.duration
        );

        const existing = uniqueParticipantMap.get(key);
        if (existing) {
            existing.totalDurationSeconds += durationSeconds;
        } else {
            uniqueParticipantMap.set(key, {
                userId: attendance.userId,
                email: attendance.email,
                participantName: attendance.participantName,
                totalDurationSeconds: durationSeconds,
            });
        }
    }

    const totalParticipants = uniqueParticipantMap.size;
    const totalDurationSeconds = Array.from(uniqueParticipantMap.values()).reduce(
        (sum, item) => sum + item.totalDurationSeconds,
        0
    );
    const averageDurationSeconds = totalParticipants
        ? Math.round(totalDurationSeconds / totalParticipants)
        : 0;

    const enrolledStudents = zoomMeeting.batchClass?.batch?._count?.enrollments || 0;
    const presentEnrolledStudents = Array.from(uniqueParticipantMap.values()).filter(
        (participant) => participant.userId !== null
    ).length;

    return {
        meeting: {
            meetingId: zoomMeeting.meetingId,
            topic: zoomMeeting.topic,
            status: zoomMeeting.status,
            startTime: zoomMeeting.startTime,
            actualStartTime: zoomMeeting.actualStartTime,
            actualEndTime: zoomMeeting.actualEndTime,
            batchClassId: zoomMeeting.batchClassId,
        },
        summary: {
            totalParticipants,
            enrolledStudents,
            presentEnrolledStudents,
            absentStudents: Math.max(enrolledStudents - presentEnrolledStudents, 0),
            averageDurationSeconds,
            averageDurationMinutes: Number((averageDurationSeconds / 60).toFixed(2)),
        },
        attendances: attendances.map((attendance) => ({
            id: attendance.id,
            participantZoomId: attendance.participantZoomId,
            participantName: attendance.participantName,
            email: attendance.email,
            userId: attendance.userId,
            userName: attendance.user?.name ?? null,
            joinTime: attendance.joinTime,
            leaveTime: attendance.leaveTime,
            status: attendance.status,
            durationSeconds: calculateDurationSeconds(
                attendance.joinTime,
                attendance.leaveTime,
                attendance.duration
            ),
        })),
    };
};

const getBatchClassAttendanceReport = async (
    batchClassId: string,
    authUser: AuthUser
) => {
    await validateBatchClassAccess(batchClassId, authUser);

    const batchClass = await prisma.batchClass.findUnique({
        where: { id: batchClassId },
        include: {
            batch: {
                include: {
                    enrollments: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    profilePhoto: true,
                                },
                            },
                        },
                    },
                },
            },
            batchClassAttendances: {
                include: {
                    attendance: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!batchClass) {
        throw new ApiError(httpCode.NOT_FOUND, "Batch class not found");
    }

    const attendanceRecords = batchClass.batchClassAttendances.map(
        (item) => item.attendance
    );

    const enrollmentMap = new Map<
        string,
        {
            userId: string;
            name: string;
            email: string;
            profilePhoto: string | null;
            present: boolean;
            sessionCount: number;
            totalDurationSeconds: number;
            firstJoinTime: Date | null;
            lastLeaveTime: Date | null;
        }
    >();

    const emailToUserIdMap = new Map<string, string>();

    for (const enrollment of batchClass.batch.enrollments) {
        enrollmentMap.set(enrollment.userId, {
            userId: enrollment.user.id,
            name: enrollment.user.name,
            email: enrollment.user.email,
            profilePhoto: enrollment.user.profilePhoto || null,
            present: false,
            sessionCount: 0,
            totalDurationSeconds: 0,
            firstJoinTime: null,
            lastLeaveTime: null,
        });

        emailToUserIdMap.set(enrollment.user.email.toLowerCase(), enrollment.userId);
    }

    const unknownParticipants: Array<{
        participantName: string;
        email: string | null;
        joinTime: Date;
        leaveTime: Date | null;
        durationSeconds: number;
    }> = [];

    for (const attendance of attendanceRecords) {
        const durationSeconds = calculateDurationSeconds(
            attendance.joinTime,
            attendance.leaveTime,
            attendance.duration
        );

        const matchedUserId =
            (attendance.userId && enrollmentMap.has(attendance.userId)
                ? attendance.userId
                : null) ||
            (attendance.email
                ? emailToUserIdMap.get(attendance.email.toLowerCase()) || null
                : null);

        if (!matchedUserId) {
            unknownParticipants.push({
                participantName: attendance.participantName,
                email: attendance.email,
                joinTime: attendance.joinTime,
                leaveTime: attendance.leaveTime,
                durationSeconds,
            });
            continue;
        }

        const row = enrollmentMap.get(matchedUserId)!;
        row.present = true;
        row.sessionCount += 1;
        row.totalDurationSeconds += durationSeconds;
        row.firstJoinTime =
            row.firstJoinTime && row.firstJoinTime < attendance.joinTime
                ? row.firstJoinTime
                : attendance.joinTime;
        row.lastLeaveTime =
            row.lastLeaveTime &&
            attendance.leaveTime &&
            row.lastLeaveTime > attendance.leaveTime
                ? row.lastLeaveTime
                : attendance.leaveTime || row.lastLeaveTime;
    }

    const students = Array.from(enrollmentMap.values())
        .map((student) => ({
            userId: student.userId,
            name: student.name,
            email: student.email,
            profilePhoto: student.profilePhoto,
            status: student.present ? "PRESENT" : "ABSENT",
            sessionCount: student.sessionCount,
            totalDurationSeconds: student.totalDurationSeconds,
            totalDurationMinutes: Number((student.totalDurationSeconds / 60).toFixed(2)),
            firstJoinTime: student.firstJoinTime,
            lastLeaveTime: student.lastLeaveTime,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const totalStudents = students.length;
    const presentStudents = students.filter((student) => student.status === "PRESENT").length;
    const absentStudents = totalStudents - presentStudents;
    const attendanceRate = totalStudents
        ? Number(((presentStudents / totalStudents) * 100).toFixed(2))
        : 0;

    return {
        class: {
            id: batchClass.id,
            title: batchClass.title,
            startTime: batchClass.startTime,
            duration: batchClass.duration,
            zoomMeetingId: batchClass.zoomMeetingId,
            batch: {
                id: batchClass.batch.id,
                name: batchClass.batch.name,
                slug: batchClass.batch.slug,
            },
        },
        summary: {
            totalStudents,
            presentStudents,
            absentStudents,
            attendanceRate,
            unknownParticipants: unknownParticipants.length,
        },
        students,
        unknownParticipants,
    };
};

const getMyBatchClassAttendance = async (batchClassId: string, userId: string) => {
    const report = await getBatchClassAttendanceReport(batchClassId, {
        id: userId,
        role: UserRole.STUDENT,
    });

    const student = report.students.find((item) => item.userId === userId);

    return {
        class: report.class,
        summary: {
            status: student?.status ?? "ABSENT",
            sessionCount: student?.sessionCount ?? 0,
            totalDurationSeconds: student?.totalDurationSeconds ?? 0,
            totalDurationMinutes: student?.totalDurationMinutes ?? 0,
            firstJoinTime: student?.firstJoinTime ?? null,
            lastLeaveTime: student?.lastLeaveTime ?? null,
        },
    };
};

const processZoomWebhook = async (req: Request): Promise<ZoomWebhookResult> => {
    const secretToken = process.env.ZOOM_WEBHOOK_SECRET;

    if (!secretToken) {
        throw new ApiError(
            httpCode.INTERNAL_SERVER_ERROR,
            "ZOOM_WEBHOOK_SECRET is not configured"
        );
    }

    const requestTimestamp = getHeaderValue(req.headers["x-zm-request-timestamp"]);
    const requestSignature = getHeaderValue(req.headers["x-zm-signature"]);

    if (!requestTimestamp || !requestSignature) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Missing Zoom signature headers" },
        };
    }

    const timestampNumber = Number(requestTimestamp);
    if (!Number.isFinite(timestampNumber)) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Invalid Zoom timestamp header" },
        };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - timestampNumber) > ZOOM_SIGNATURE_TTL_SECONDS) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Stale Zoom webhook request" },
        };
    }

    const rawBody = getRawRequestBody(req);
    const message = `${ZOOM_SIGNATURE_VERSION}:${requestTimestamp}:${rawBody}`;
    const hashForVerify = crypto
        .createHmac("sha256", secretToken)
        .update(message)
        .digest("hex");

    const signature = `${ZOOM_SIGNATURE_VERSION}=${hashForVerify}`;

    if (!isValidSignature(signature, requestSignature)) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Invalid Zoom signature" },
        };
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === "endpoint.url_validation") {
        const plainToken = payload?.plainToken;

        if (!plainToken || typeof plainToken !== "string") {
            return {
                statusCode: httpCode.BAD_REQUEST,
                body: { message: "Invalid Zoom plainToken" },
            };
        }

        const encryptedToken = crypto
            .createHmac("sha256", secretToken)
            .update(plainToken)
            .digest("hex");

        return {
            statusCode: httpCode.OK,
            body: { plainToken, encryptedToken },
        };
    }

    switch (event) {
        case "meeting.started":
            await handleMeetingStarted(payload);
            break;
        case "meeting.ended":
            await handleMeetingEnded(payload);
            break;
        case "meeting.participant_joined":
            await handleParticipantJoined(payload);
            break;
        case "meeting.participant_left":
            await handleParticipantLeft(payload);
            break;
        case "recording.completed":
            await handleRecordingCompleted(payload);
            break;
        default:
            break;
    }

    return {
        statusCode: httpCode.OK,
        body: { received: true },
    };
};

export const zoomService = {
    createZoomMeeting,
    processZoomWebhook,
    getMeetingParticipants,
    syncAttendanceAfterMeeting,
    createMeetingRegistration,
    createRegistrationForUser,
    getMeetingAttendanceReport,
    getBatchClassAttendanceReport,
    getMyBatchClassAttendance,
};
