import prismaClientPkg from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

const { UserRole } = prismaClientPkg;

type AuthUser = { id: string; role: string };
type ClassTimelineStatus = "UPCOMING" | "ONGOING" | "ENDED";

const calculateDurationSeconds = (
    joinTime: Date,
    leaveTime: Date | null,
    existingDuration: number | null
) => {
    if (typeof existingDuration === "number" && existingDuration >= 0) {
        return existingDuration;
    }
    if (!leaveTime) return 0;
    return Math.max(0, Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000));
};

const getParticipantKey = (params: {
    userId: string | null;
    email: string | null;
    participantZoomId: string;
}) => {
    if (params.userId) return `user:${params.userId}`;
    if (params.email) return `email:${params.email.toLowerCase()}`;
    return `zoom:${params.participantZoomId}`;
};

const getClassTimelineStatus = (
    startTime: Date,
    durationMinutes: number
): ClassTimelineStatus => {
    const now = Date.now();
    const classStart = startTime.getTime();
    const classEnd = classStart + durationMinutes * 60_000;

    if (now < classStart) return "UPCOMING";
    if (now <= classEnd) return "ONGOING";
    return "ENDED";
};

const resolveBatchClassByMeetingId = async (meetingId: string) => {
    const byBatchClassMeetingId = await prisma.batchClass.findFirst({
        where: { zoomMeetingId: meetingId },
        include: { batch: { include: { _count: { select: { enrollments: true } } } } },
    });

    if (byBatchClassMeetingId) return byBatchClassMeetingId;

    const meeting = await prisma.zoomMeeting.findUnique({
        where: { meetingId },
        select: { batchClassId: true },
    });

    if (!meeting?.batchClassId) return null;

    return prisma.batchClass.findUnique({
        where: { id: meeting.batchClassId },
        include: { batch: { include: { _count: { select: { enrollments: true } } } } },
    });
};

const validateMeetingAccess = async (meetingId: string, authUser: AuthUser) => {
    if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPER_ADMIN) {
        return;
    }

    const batchClass = await resolveBatchClassByMeetingId(meetingId);
    if (!batchClass) return;

    if (authUser.role === UserRole.INSTRUCTOR && batchClass.instructorId !== authUser.id) {
        throw new ApiError(
            httpCode.FORBIDDEN,
            "You are not allowed to access this meeting attendance"
        );
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
        throw new ApiError(
            httpCode.FORBIDDEN,
            "You are not allowed to access this class attendance"
        );
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

const getMyBatchAttendanceByBatch = async (batchRef: string, userId: string) => {
    const normalizedBatchRef = batchRef?.trim();
    if (!normalizedBatchRef) {
        throw new ApiError(httpCode.BAD_REQUEST, "Batch id or slug is required");
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
    });

    if (!user) {
        throw new ApiError(httpCode.NOT_FOUND, "User not found");
    }

    const batch = await prisma.batch.findFirst({
        where: {
            OR: [
                { id: normalizedBatchRef },
                {
                    slug: {
                        equals: normalizedBatchRef,
                        mode: "insensitive",
                    },
                },
            ],
            enrollments: {
                some: { userId },
            },
        },
        select: {
            id: true,
            name: true,
            slug: true,
            batchClasses: {
                select: {
                    id: true,
                    title: true,
                    startTime: true,
                    duration: true,
                    zoomMeetingId: true,
                    zoomJoinUrl: true,
                },
                orderBy: { startTime: "asc" },
            },
        },
    });

    if (!batch) {
        throw new ApiError(httpCode.NOT_FOUND, "Batch not found or not enrolled");
    }

    if (!batch.batchClasses.length) {
        return {
            batch: {
                id: batch.id,
                name: batch.name,
                slug: batch.slug,
            },
            student: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
            summary: {
                totalClasses: 0,
                attendedClasses: 0,
                absentClasses: 0,
                attendanceRate: 0,
                totalDurationSeconds: 0,
                totalDurationMinutes: 0,
                upcomingClasses: 0,
                ongoingClasses: 0,
                endedClasses: 0,
            },
            classes: [],
        };
    }

    const classIds = batch.batchClasses.map((item) => item.id);
    const attendanceFilterByUserEmail = user.email
        ? [{ email: { equals: user.email, mode: "insensitive" as const } }]
        : [];

    const batchClassAttendances = await prisma.batchClassAttendance.findMany({
        where: {
            batchClassId: { in: classIds },
            attendance: {
                OR: [{ userId: user.id }, ...attendanceFilterByUserEmail],
            },
        },
        include: {
            attendance: true,
        },
    });

    type AttendanceAggregate = {
        sessionCount: number;
        totalDurationSeconds: number;
        firstJoinTime: Date | null;
        lastLeaveTime: Date | null;
    };

    const attendanceByClassId = new Map<string, AttendanceAggregate>();

    for (const record of batchClassAttendances) {
        const durationSeconds = calculateDurationSeconds(
            record.attendance.joinTime,
            record.attendance.leaveTime,
            record.attendance.duration
        );

        const existing = attendanceByClassId.get(record.batchClassId);
        if (!existing) {
            attendanceByClassId.set(record.batchClassId, {
                sessionCount: 1,
                totalDurationSeconds: durationSeconds,
                firstJoinTime: record.attendance.joinTime,
                lastLeaveTime: record.attendance.leaveTime,
            });
            continue;
        }

        existing.sessionCount += 1;
        existing.totalDurationSeconds += durationSeconds;
        existing.firstJoinTime =
            existing.firstJoinTime && existing.firstJoinTime < record.attendance.joinTime
                ? existing.firstJoinTime
                : record.attendance.joinTime;

        if (record.attendance.leaveTime) {
            existing.lastLeaveTime =
                existing.lastLeaveTime && existing.lastLeaveTime > record.attendance.leaveTime
                    ? existing.lastLeaveTime
                    : record.attendance.leaveTime;
        }
    }

    const classes = batch.batchClasses.map((item) => {
        const attendance = attendanceByClassId.get(item.id);
        const classStatus = getClassTimelineStatus(item.startTime, item.duration);
        const totalDurationSeconds = attendance?.totalDurationSeconds ?? 0;

        return {
            classId: item.id,
            title: item.title,
            startTime: item.startTime,
            durationMinutes: item.duration,
            classStatus,
            zoomMeetingId: item.zoomMeetingId,
            zoomJoinUrl: item.zoomJoinUrl,
            attendanceStatus: attendance ? "PRESENT" : "ABSENT",
            sessionCount: attendance?.sessionCount ?? 0,
            firstJoinTime: attendance?.firstJoinTime ?? null,
            lastLeaveTime: attendance?.lastLeaveTime ?? null,
            totalDurationSeconds,
            totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(2)),
        };
    });

    const totalClasses = classes.length;
    const attendedClasses = classes.filter((item) => item.attendanceStatus === "PRESENT").length;
    const absentClasses = totalClasses - attendedClasses;
    const totalDurationSeconds = classes.reduce(
        (sum, item) => sum + item.totalDurationSeconds,
        0
    );
    const attendanceRate = totalClasses
        ? Number(((attendedClasses / totalClasses) * 100).toFixed(2))
        : 0;

    return {
        batch: {
            id: batch.id,
            name: batch.name,
            slug: batch.slug,
        },
        student: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
        summary: {
            totalClasses,
            attendedClasses,
            absentClasses,
            attendanceRate,
            totalDurationSeconds,
            totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(2)),
            upcomingClasses: classes.filter((item) => item.classStatus === "UPCOMING").length,
            ongoingClasses: classes.filter((item) => item.classStatus === "ONGOING").length,
            endedClasses: classes.filter((item) => item.classStatus === "ENDED").length,
        },
        classes,
    };
};

export const attendanceService = {
    getMeetingAttendanceReport,
    getBatchClassAttendanceReport,
    getMyBatchClassAttendance,
    getMyBatchAttendanceByBatch,
};
