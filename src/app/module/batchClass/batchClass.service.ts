import prisma from "../../../lib/prisma.js";
import { zoomService } from "../zoom/zoom.service.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

/* =====================================================
   Helper: Dynamic Status
===================================================== */

const calculateStatus = (startTime: Date, duration: number) => {
    const now = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (now < startTime) return "UPCOMING";
    if (now >= startTime && now <= endTime) return "ONGOING";
    return "ENDED";
};

/* =====================================================
   Instructor: Create Class
===================================================== */

const createClass = async (user: any, payload: any) => {
    if (!payload.title) {
        throw new ApiError(httpCode.BAD_REQUEST, "Title is required");
    }

    const duration = Number(payload.duration);
    if (!duration || duration <= 0) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid duration");
    }

    const startTime = new Date(payload.startTime);
    if (Number.isNaN(startTime.getTime())) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid start time");
    }

    const batch = await prisma.batch.findUnique({
        where: { id: payload.batchId },
    });

    if (!batch) {
        throw new ApiError(httpCode.NOT_FOUND, "Batch not found");
    }

    const zoomMeeting = await zoomService.createZoomMeeting({
        topic: payload.title,
        startTime,
        duration,
    });

    return prisma.batchClass.create({
        data: {
            batchId: payload.batchId,
            instructorId: user.id,
            title: payload.title,
            description: payload.description || null,
            startTime,
            duration,
            zoomMeetingId: String(zoomMeeting.id),
            zoomJoinUrl: zoomMeeting.join_url,
            zoomStartUrl: zoomMeeting.start_url,
        },
    });
};

/* =====================================================
   Instructor: Get All Own Classes (Manage Page)
===================================================== */

const getInstructorClasses = async (batchId: string) => {
    const classes = await prisma.batchClass.findMany({
        where: { batchId },
        include: { batch: true },
        orderBy: { startTime: "desc" },
    });

    return classes.map(cls => ({
        ...cls,
        status: calculateStatus(cls.startTime, cls.duration),
    }));
};

/* =====================================================
   Instructor: Get Single Class
===================================================== */

const getInstructorSingleClass = async (
    instructorId: string,
    classId: string
) => {
    const cls = await prisma.batchClass.findFirst({
        where: {
            id: classId,
            instructorId,
        },
        include: { batch: true },
    });

    if (!cls) {
        throw new ApiError(httpCode.NOT_FOUND, "Class not found");
    }

    return {
        ...cls,
        status: calculateStatus(cls.startTime, cls.duration),
    };
};

/* =====================================================
   Instructor: Update Class
===================================================== */

const updateClass = async (
    instructorId: string,
    classId: string,
    payload: any
) => {
    const existing = await prisma.batchClass.findFirst({
        where: {
            id: classId,
            instructorId,
        },
    });

    if (!existing) {
        throw new ApiError(
            httpCode.NOT_FOUND,
            "Class not found or unauthorized"
        );
    }

    return prisma.batchClass.update({
        where: { id: classId },
        data: {
            title: payload.title ?? existing.title,
            description: payload.description ?? existing.description,
            startTime: payload.startTime
                ? new Date(payload.startTime)
                : existing.startTime,
            duration: payload.duration
                ? Number(payload.duration)
                : existing.duration,
        },
    });
};

/* =====================================================
   Instructor: Delete Class
===================================================== */

const deleteClass = async (
    instructorId: string,
    classId: string
) => {
    const existing = await prisma.batchClass.findFirst({
        where: {
            id: classId,
            instructorId,
        },
    });

    if (!existing) {
        throw new ApiError(
            httpCode.NOT_FOUND,
            "Class not found or unauthorized"
        );
    }

    return prisma.batchClass.delete({
        where: { id: classId },
    });
};

/* =====================================================
   Student: Get Enrolled Classes
===================================================== */

const getStudentClasses = async (userId: string, batchSlug: string) => {
    const batchRef = batchSlug?.trim();

    if (!batchRef) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Batch slug is required"
        );
    }

    const batch = await prisma.batch.findFirst({
        where: {
            enrollments: {
                some: { userId },
            },
            OR: [
                { id: batchRef },
                {
                    slug: {
                        equals: batchRef,
                        mode: "insensitive",
                    },
                },
            ],
        },
        select: { id: true },
    });

    if (!batch) {
        return [];
    }

    const classes = await prisma.batchClass.findMany({
        where: { batchId: batch.id },
        orderBy: { startTime: "asc" },
    });

    return classes.map((cls) => ({
        ...cls,
        status: calculateStatus(cls.startTime, cls.duration),
    }));
};

/* =====================================================
   Export
===================================================== */

export const batchClassService = {
    // Instructor manage
    createClass,
    getInstructorClasses,
    getInstructorSingleClass,
    updateClass,
    deleteClass,

    // Student
    getStudentClasses,
};
