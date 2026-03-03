import prismaClientPkg from "@prisma/client";
import prisma from "../../../lib/prisma.js";

const { BatchStatus, PaymentStatus, UserRole } = prismaClientPkg;
type BatchStatusValue = (typeof BatchStatus)[keyof typeof BatchStatus];

const getTodayRange = (baseDate: Date) => {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

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
            title: "LMS System Overview",
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

export const DashboardService = {
    getDashboardOverview,
};
