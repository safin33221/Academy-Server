import prismaClientPkg from "@prisma/client";
import prisma from "../../../lib/prisma.js";

const { BatchStatus, PaymentStatus, UserRole } = prismaClientPkg;
type BatchStatusValue = (typeof BatchStatus)[keyof typeof BatchStatus];
type ClassTimelineStatus = "UPCOMING" | "ONGOING" | "ENDED";
type ClassAttendanceAggregation = {
    matchedStudentIds: Set<string>;
    unknownParticipants: number;
    totalDurationSeconds: number;
    totalSessions: number;
};
type EnrollmentLookup = {
    studentIds: Set<string>;
    emailToStudentId: Map<string, string>;
};
type DailyAttendanceTrend = {
    date: string;
    totalClasses: number;
    expectedStudents: number;
    presentStudents: number;
};

const getTodayRange = (baseDate: Date) => {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

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

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(amount);

const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);

const formatTimeRange = (startTime: Date, durationMinutes: number) => {
    const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
    const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    return `${formatter.format(startTime)} - ${formatter.format(endTime)}`;
};

const getClassTimelineStatus = (
    startTime: Date,
    durationMinutes: number,
    now: Date
): ClassTimelineStatus => {
    const classStart = startTime.getTime();
    const classEnd = classStart + durationMinutes * 60_000;
    const currentTime = now.getTime();

    if (currentTime < classStart) return "UPCOMING";
    if (currentTime <= classEnd) return "ONGOING";
    return "ENDED";
};

const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const toSafeEmail = (email: string | null | undefined) =>
    email?.trim().toLowerCase() || null;

const toEnrollmentStatusLabel = (status: BatchStatusValue) => {
    if (status === BatchStatus.ONGOING) return "Active";
    if (status === BatchStatus.COMPLETED) return "Completed";
    if (status === BatchStatus.UPCOMING) return "Upcoming";
    return "Cancelled";
};

const calculateBatchProgress = (params: {
    startDate: Date;
    endDate: Date | null;
    status: BatchStatusValue;
    totalClassCount: number;
    endedClassCount: number;
    now: Date;
}) => {
    const { startDate, endDate, status, totalClassCount, endedClassCount, now } = params;

    if (endDate && endDate > startDate) {
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        return clamp(Math.round((elapsed / totalDuration) * 100), 0, 100);
    }

    if (totalClassCount > 0) {
        return clamp(Math.round((endedClassCount / totalClassCount) * 100), 0, 100);
    }

    if (status === BatchStatus.COMPLETED) return 100;
    if (status === BatchStatus.ONGOING) return 50;
    return 0;
};

const getDashboardOverview = async () => {
    const now = new Date();
    const { start, end } = getTodayRange(now);

    const [
        totalStudents,
        totalInstructors,
        totalCourses,
        revenueAggregate,
        activeEnrollments,
        todaysClassesRaw,
        ongoingBatches,
        paidOrders,
        enrollmentsForTopCourses,
        recentPaidOrders,
    ] = await Promise.all([
        prisma.user.count({
            where: {
                role: UserRole.STUDENT,
                isDeleted: false,
            },
        }),
        prisma.user.count({
            where: {
                role: UserRole.INSTRUCTOR,
                isDeleted: false,
            },
        }),
        prisma.course.count({
            where: {
                isDeleted: false,
            },
        }),
        prisma.order.aggregate({
            where: { status: PaymentStatus.PAID },
            _sum: { amount: true },
        }),
        prisma.enrollment.count({
            where: {
                batch: {
                    status: BatchStatus.ONGOING,
                    isDeleted: false,
                },
            },
        }),
        prisma.batchClass.findMany({
            where: {
                startTime: {
                    gte: start,
                    lte: end,
                },
            },
            include: {
                batch: {
                    select: {
                        id: true,
                        name: true,
                        course: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: { startTime: "asc" },
            take: 10,
        }),
        prisma.batch.findMany({
            where: {
                status: BatchStatus.ONGOING,
                isDeleted: false,
            },
            include: {
                course: {
                    select: {
                        title: true,
                    },
                },
                instructors: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { startDate: "asc" },
            take: 6,
        }),
        prisma.order.findMany({
            where: {
                status: PaymentStatus.PAID,
            },
            select: {
                amount: true,
                batch: {
                    select: {
                        courseId: true,
                        course: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.enrollment.findMany({
            select: {
                userId: true,
                batch: {
                    select: {
                        courseId: true,
                        course: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.order.findMany({
            where: {
                status: PaymentStatus.PAID,
            },
            include: {
                user: {
                    select: {
                        name: true,
                    },
                },
                batch: {
                    select: {
                        status: true,
                        course: {
                            select: {
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),
    ]);

    const instructorIds = Array.from(
        new Set(todaysClassesRaw.map((item) => item.instructorId))
    );

    const instructorRecords = instructorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: instructorIds } },
            select: { id: true, name: true },
        })
        : [];

    const instructorMap = new Map(
        instructorRecords.map((instructor) => [instructor.id, instructor.name])
    );

    const scheduledBatchIds = Array.from(
        new Set(todaysClassesRaw.map((item) => item.batchId))
    );

    const studentsInScheduledBatches = scheduledBatchIds.length
        ? await prisma.enrollment.findMany({
            where: {
                batchId: {
                    in: scheduledBatchIds,
                },
            },
            distinct: ["userId"],
            select: {
                userId: true,
            },
        })
        : [];

    const presentStudents = studentsInScheduledBatches.length;
    const attendancePercentage = totalStudents
        ? Number(((presentStudents / totalStudents) * 100).toFixed(2))
        : 0;

    const ongoingBatchIds = ongoingBatches.map((batch) => batch.id);
    const [totalClassGroups, endedClassGroups] = ongoingBatchIds.length
        ? await Promise.all([
            prisma.batchClass.groupBy({
                by: ["batchId"],
                where: {
                    batchId: { in: ongoingBatchIds },
                },
                _count: { _all: true },
            }),
            prisma.batchClass.groupBy({
                by: ["batchId"],
                where: {
                    batchId: { in: ongoingBatchIds },
                    startTime: { lte: now },
                },
                _count: { _all: true },
            }),
        ])
        : [[], []];

    const totalClassCountMap = new Map(
        totalClassGroups.map((group) => [group.batchId, group._count._all])
    );
    const endedClassCountMap = new Map(
        endedClassGroups.map((group) => [group.batchId, group._count._all])
    );

    const totalRevenue = Number(revenueAggregate._sum.amount ?? 0);

    const ongoingCourses = ongoingBatches.map((batch) => {
        const progressPercentage = calculateBatchProgress({
            startDate: batch.startDate,
            endDate: batch.endDate,
            status: batch.status,
            totalClassCount: totalClassCountMap.get(batch.id) ?? 0,
            endedClassCount: endedClassCountMap.get(batch.id) ?? 0,
            now,
        });

        return {
            batchId: batch.id,
            title: batch.course.title,
            instructor:
                batch.instructors.map((instructor) => instructor.name).join(", ") ||
                "TBA",
            progress: `${progressPercentage}%`,
            progressPercentage,
        };
    });

    const todaysClasses = todaysClassesRaw.map((item) => ({
        id: item.id,
        course: item.batch.course.title,
        batchName: item.batch.name,
        instructor: instructorMap.get(item.instructorId) || "TBA",
        room: item.zoomJoinUrl ? "Online (Zoom)" : "Online",
        time: formatTimeRange(item.startTime, item.duration),
        startTime: item.startTime.toISOString(),
        duration: item.duration,
    }));

    const topCourseMap = new Map<
        string,
        {
            courseId: string;
            name: string;
            revenue: number;
            students: Set<string>;
        }
    >();

    const getTopCourseEntry = (courseId: string, name: string) => {
        if (!topCourseMap.has(courseId)) {
            topCourseMap.set(courseId, {
                courseId,
                name,
                revenue: 0,
                students: new Set<string>(),
            });
        }

        return topCourseMap.get(courseId)!;
    };

    for (const order of paidOrders) {
        const courseId = order.batch?.courseId;
        const courseTitle = order.batch?.course?.title;

        if (!courseId || !courseTitle) continue;

        const entry = getTopCourseEntry(courseId, courseTitle);
        entry.revenue += Number(order.amount || 0);
    }

    for (const enrollment of enrollmentsForTopCourses) {
        const courseId = enrollment.batch?.courseId;
        const courseTitle = enrollment.batch?.course?.title;

        if (!courseId || !courseTitle) continue;

        const entry = getTopCourseEntry(courseId, courseTitle);
        entry.students.add(enrollment.userId);
    }

    const topPerformingCourses = Array.from(topCourseMap.values())
        .map((entry) => ({
            courseId: entry.courseId,
            name: entry.name,
            students: entry.students.size,
            revenue: Number(entry.revenue.toFixed(2)),
            revenueDisplay: formatCurrency(entry.revenue),
        }))
        .sort((a, b) => {
            if (b.revenue !== a.revenue) return b.revenue - a.revenue;
            return b.students - a.students;
        })
        .slice(0, 5);

    const recentEnrollments = recentPaidOrders.map((order) => ({
        student: order.user.name,
        course: order.batch.course.title,
        status: toEnrollmentStatusLabel(order.batch.status),
        date: formatDate(order.createdAt),
        enrolledAt: order.createdAt.toISOString(),
    }));

    return {
        pageHeader: {
            title: "Nexaali Academy System Overview",
            subtitle: "Complete analytics, attendance & course tracking",
            generatedAt: now.toISOString(),
        },
        coreStats: {
            totalStudents,
            totalInstructors,
            totalCourses,
            totalRevenue,
            totalRevenueDisplay: formatCurrency(totalRevenue),
        },
        attendanceAndEnrollment: {
            todayAttendance: {
                percentage: attendancePercentage,
                presentStudents,
                isEstimated: true,
                note: "Estimated from students enrolled in batches with classes scheduled today.",
            },
            activeEnrollments,
            systemHealth: {
                status: "Operational",
                note: "No issues detected",
                checkedAt: now.toISOString(),
            },
        },
        ongoingCourses,
        todaysClasses,
        topPerformingCourses,
        recentEnrollments,
    };
};

const getClassAttendanceOverview = async () => {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = getTodayRange(now);

    const allClasses = await prisma.batchClass.findMany({
        select: {
            id: true,
            batchId: true,
            instructorId: true,
            title: true,
            startTime: true,
            duration: true,
            zoomMeetingId: true,
        },
        orderBy: { startTime: "desc" },
    });

    const classSummary = {
        totalClasses: allClasses.length,
        upcomingClasses: 0,
        ongoingClasses: 0,
        endedClasses: 0,
        todayClasses: 0,
        startedTodayClasses: 0,
        upcomingTodayClasses: 0,
        conductedClasses: 0,
    };

    const startedClasses: typeof allClasses = [];
    const todayClasses: typeof allClasses = [];

    for (const batchClass of allClasses) {
        const timelineStatus = getClassTimelineStatus(
            batchClass.startTime,
            batchClass.duration,
            now
        );

        if (timelineStatus === "UPCOMING") classSummary.upcomingClasses += 1;
        else if (timelineStatus === "ONGOING") classSummary.ongoingClasses += 1;
        else classSummary.endedClasses += 1;

        const isToday =
            batchClass.startTime >= todayStart && batchClass.startTime <= todayEnd;
        if (isToday) {
            classSummary.todayClasses += 1;
            todayClasses.push(batchClass);

            if (batchClass.startTime <= now) {
                classSummary.startedTodayClasses += 1;
            } else {
                classSummary.upcomingTodayClasses += 1;
            }
        }

        if (batchClass.startTime <= now) {
            classSummary.conductedClasses += 1;
            startedClasses.push(batchClass);
        }
    }

    todayClasses.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const recentClassesForList = startedClasses.slice(0, 12);
    const relevantBatchIds = Array.from(
        new Set([...startedClasses, ...todayClasses].map((item) => item.batchId))
    );
    const startedClassIds = startedClasses.map((item) => item.id);
    const instructorIds = Array.from(
        new Set(
            [...recentClassesForList, ...todayClasses].map((item) => item.instructorId)
        )
    );

    const enrollmentsPromise = relevantBatchIds.length
        ? prisma.enrollment.findMany({
            where: { batchId: { in: relevantBatchIds } },
            select: {
                batchId: true,
                userId: true,
                user: {
                    select: {
                        email: true,
                    },
                },
            },
        })
        : Promise.resolve([]);

    const batchAttendancesPromise = startedClassIds.length
        ? prisma.batchClassAttendance.findMany({
            where: { batchClassId: { in: startedClassIds } },
            select: {
                batchClassId: true,
                attendance: {
                    select: {
                        userId: true,
                        email: true,
                        joinTime: true,
                        leaveTime: true,
                        duration: true,
                    },
                },
            },
        })
        : Promise.resolve([]);

    const batchesPromise = relevantBatchIds.length
        ? prisma.batch.findMany({
            where: { id: { in: relevantBatchIds } },
            select: {
                id: true,
                name: true,
                slug: true,
                course: {
                    select: {
                        title: true,
                    },
                },
            },
        })
        : Promise.resolve([]);

    const instructorsPromise = instructorIds.length
        ? prisma.user.findMany({
            where: { id: { in: instructorIds } },
            select: {
                id: true,
                name: true,
            },
        })
        : Promise.resolve([]);

    const [enrollments, batchAttendances, batches, instructors] = await Promise.all([
        enrollmentsPromise,
        batchAttendancesPromise,
        batchesPromise,
        instructorsPromise,
    ]);

    const classById = new Map(allClasses.map((item) => [item.id, item]));

    const enrollmentLookupByBatchId = new Map<string, EnrollmentLookup>();
    for (const enrollment of enrollments) {
        const existingLookup = enrollmentLookupByBatchId.get(enrollment.batchId) ?? {
            studentIds: new Set<string>(),
            emailToStudentId: new Map<string, string>(),
        };

        existingLookup.studentIds.add(enrollment.userId);

        const emailKey = toSafeEmail(enrollment.user.email);
        if (emailKey) {
            existingLookup.emailToStudentId.set(emailKey, enrollment.userId);
        }

        enrollmentLookupByBatchId.set(enrollment.batchId, existingLookup);
    }

    const attendanceByClassId = new Map<string, ClassAttendanceAggregation>();
    for (const record of batchAttendances) {
        const batchClass = classById.get(record.batchClassId);
        if (!batchClass) continue;

        const enrollmentLookup = enrollmentLookupByBatchId.get(batchClass.batchId);
        const existingAggregation = attendanceByClassId.get(record.batchClassId) ?? {
            matchedStudentIds: new Set<string>(),
            unknownParticipants: 0,
            totalDurationSeconds: 0,
            totalSessions: 0,
        };

        const durationSeconds = calculateDurationSeconds(
            record.attendance.joinTime,
            record.attendance.leaveTime,
            record.attendance.duration
        );

        existingAggregation.totalDurationSeconds += durationSeconds;
        existingAggregation.totalSessions += 1;

        const directMatchedUserId =
            record.attendance.userId &&
                enrollmentLookup?.studentIds.has(record.attendance.userId)
                ? record.attendance.userId
                : null;

        const emailMatchedUserId = (() => {
            const emailKey = toSafeEmail(record.attendance.email);
            if (!emailKey) return null;
            return enrollmentLookup?.emailToStudentId.get(emailKey) ?? null;
        })();

        const matchedUserId = directMatchedUserId ?? emailMatchedUserId;

        if (matchedUserId) {
            existingAggregation.matchedStudentIds.add(matchedUserId);
        } else {
            existingAggregation.unknownParticipants += 1;
        }

        attendanceByClassId.set(record.batchClassId, existingAggregation);
    }

    const batchById = new Map(batches.map((batch) => [batch.id, batch]));
    const instructorById = new Map(
        instructors.map((instructor) => [instructor.id, instructor.name])
    );

    const buildClassMetrics = (classes: typeof allClasses) =>
        classes.map((item) => {
            const enrollmentLookup = enrollmentLookupByBatchId.get(item.batchId);
            const attendanceAggregation = attendanceByClassId.get(item.id);
            const batch = batchById.get(item.batchId);

            const expectedStudents = enrollmentLookup?.studentIds.size ?? 0;
            const presentStudents = attendanceAggregation?.matchedStudentIds.size ?? 0;
            const absentStudents = Math.max(expectedStudents - presentStudents, 0);
            const attendanceRate = expectedStudents
                ? Number(((presentStudents / expectedStudents) * 100).toFixed(2))
                : 0;

            const totalDurationSeconds = attendanceAggregation?.totalDurationSeconds ?? 0;

            return {
                classId: item.id,
                title: item.title,
                startTime: item.startTime,
                durationMinutes: item.duration,
                status: getClassTimelineStatus(item.startTime, item.duration, now),
                zoomMeetingId: item.zoomMeetingId,
                batchId: item.batchId,
                batchName: batch?.name ?? "Unknown Batch",
                batchSlug: batch?.slug ?? "",
                courseTitle: batch?.course.title ?? "Untitled Course",
                instructorId: item.instructorId,
                instructor: instructorById.get(item.instructorId) ?? "TBA",
                expectedStudents,
                presentStudents,
                absentStudents,
                attendanceRate,
                sessionCount: attendanceAggregation?.totalSessions ?? 0,
                unknownParticipants: attendanceAggregation?.unknownParticipants ?? 0,
                totalDurationSeconds,
                totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(2)),
                time: formatTimeRange(item.startTime, item.duration),
            };
        });

    const startedClassMetrics = buildClassMetrics(startedClasses);
    const todayClassMetrics = buildClassMetrics(todayClasses);
    const todayStartedClassMetrics = todayClassMetrics.filter(
        (item) => item.startTime <= now
    );

    const aggregateAttendanceStats = (
        metrics: Array<{
            expectedStudents: number;
            presentStudents: number;
        }>
    ) => {
        const expectedStudents = metrics.reduce(
            (sum, item) => sum + item.expectedStudents,
            0
        );
        const presentStudents = metrics.reduce(
            (sum, item) => sum + item.presentStudents,
            0
        );
        const absentStudents = Math.max(expectedStudents - presentStudents, 0);
        const attendanceRate = expectedStudents
            ? Number(((presentStudents / expectedStudents) * 100).toFixed(2))
            : 0;

        return {
            expectedStudents,
            presentStudents,
            absentStudents,
            attendanceRate,
        };
    };

    const overallAttendance = aggregateAttendanceStats(startedClassMetrics);
    const todayAttendance = aggregateAttendanceStats(todayStartedClassMetrics);

    const averageClassAttendanceRate = startedClassMetrics.length
        ? Number(
            (
                startedClassMetrics.reduce(
                    (sum, item) => sum + item.attendanceRate,
                    0
                ) / startedClassMetrics.length
            ).toFixed(2)
        )
        : 0;

    const classesWithAttendanceRecords = startedClassMetrics.filter(
        (item) => item.sessionCount > 0
    ).length;
    const classesWithoutAttendanceRecords = Math.max(
        startedClassMetrics.length - classesWithAttendanceRecords,
        0
    );

    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);

    const dailyTrendMap = new Map<string, DailyAttendanceTrend>();
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(last7DaysStart);
        date.setDate(last7DaysStart.getDate() + i);
        const dateKey = toDateKey(date);
        dailyTrendMap.set(dateKey, {
            date: dateKey,
            totalClasses: 0,
            expectedStudents: 0,
            presentStudents: 0,
        });
    }

    for (const metric of startedClassMetrics) {
        const dateKey = toDateKey(metric.startTime);
        const trend = dailyTrendMap.get(dateKey);
        if (!trend) continue;

        trend.totalClasses += 1;
        trend.expectedStudents += metric.expectedStudents;
        trend.presentStudents += metric.presentStudents;
    }

    const dailyTrendLast7Days = Array.from(dailyTrendMap.values()).map((item) => {
        const absentStudents = Math.max(
            item.expectedStudents - item.presentStudents,
            0
        );
        const attendanceRate = item.expectedStudents
            ? Number(((item.presentStudents / item.expectedStudents) * 100).toFixed(2))
            : 0;

        return {
            ...item,
            absentStudents,
            attendanceRate,
        };
    });

    return {
        pageHeader: {
            title: "Class & Attendance Full Overview",
            subtitle: "Admin view of class execution and participation analytics",
            generatedAt: now.toISOString(),
        },
        classSummary,
        attendanceSummary: {
            ...overallAttendance,
            averageClassAttendanceRate,
            classesWithAttendanceRecords,
            classesWithoutAttendanceRecords,
        },
        todayAttendance: {
            ...todayAttendance,
            totalTodayClasses: classSummary.todayClasses,
            startedTodayClasses: classSummary.startedTodayClasses,
            upcomingTodayClasses: classSummary.upcomingTodayClasses,
            classes: todayClassMetrics.map((item) => ({
                classId: item.classId,
                title: item.title,
                course: item.courseTitle,
                batchName: item.batchName,
                instructor: item.instructor,
                status: item.status,
                startTime: item.startTime.toISOString(),
                durationMinutes: item.durationMinutes,
                time: item.time,
                expectedStudents: item.expectedStudents,
                presentStudents: item.presentStudents,
                absentStudents: item.absentStudents,
                attendanceRate: item.attendanceRate,
                unknownParticipants: item.unknownParticipants,
                zoomMeetingId: item.zoomMeetingId,
            })),
        },
        recentClassAttendance: startedClassMetrics.slice(0, 12).map((item) => ({
            classId: item.classId,
            title: item.title,
            course: item.courseTitle,
            batchName: item.batchName,
            batchSlug: item.batchSlug,
            instructor: item.instructor,
            status: item.status,
            startTime: item.startTime.toISOString(),
            durationMinutes: item.durationMinutes,
            expectedStudents: item.expectedStudents,
            presentStudents: item.presentStudents,
            absentStudents: item.absentStudents,
            attendanceRate: item.attendanceRate,
            sessionCount: item.sessionCount,
            unknownParticipants: item.unknownParticipants,
            totalDurationMinutes: item.totalDurationMinutes,
            zoomMeetingId: item.zoomMeetingId,
        })),
        dailyTrendLast7Days,
    };
};

export const DashboardService = {
    getDashboardOverview,
    getClassAttendanceOverview,
};
