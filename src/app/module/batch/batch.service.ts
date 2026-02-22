import { BatchStatus } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

const createBatch = async (payload: any) => {
    // =========================
    // 1️⃣ Validate Course Exists
    // =========================
    if (!payload.courseId) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Course ID is required"
        );
    }

    const course = await prisma.course.findUnique({
        where: { id: payload.courseId },
    });

    if (!course) {
        throw new ApiError(
            httpCode.NOT_FOUND,
            "Course not found"
        );
    }

    // =========================
    // 2️⃣ Date Validation
    // =========================
    const startDate = new Date(payload.startDate);
    const endDate = payload.endDate
        ? new Date(payload.endDate)
        : null;

    if (!payload.startDate || Number.isNaN(startDate.getTime())) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Invalid start date"
        );
    }

    if (payload.endDate && Number.isNaN(endDate?.getTime())) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Invalid end date"
        );
    }

    if (endDate && startDate >= endDate) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "End date must be greater than start date"
        );
    }

    const enrollmentStart = payload.enrollmentStart
        ? new Date(payload.enrollmentStart)
        : startDate;

    const enrollmentEnd = payload.enrollmentEnd
        ? new Date(payload.enrollmentEnd)
        : endDate ?? startDate;

    if (Number.isNaN(enrollmentStart.getTime())) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Invalid enrollment start date"
        );
    }

    if (Number.isNaN(enrollmentEnd.getTime())) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Invalid enrollment end date"
        );
    }

    if (enrollmentStart > enrollmentEnd) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Enrollment end date must be greater than enrollment start date"
        );
    }

    // =========================
    // 3️⃣ Capacity Validation
    // =========================
    const capacity = Number(payload.capacity ?? payload.maxStudents);

    if (!Number.isFinite(capacity) || capacity <= 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Capacity must be greater than 0"
        );
    }

    // =========================
    // 4️⃣ Price Validation
    // =========================
    if (payload.price && payload.price < 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Price cannot be negative"
        );
    }

    if (
        payload.discountPrice &&
        payload.price &&
        payload.discountPrice > payload.price
    ) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Discount price cannot be greater than price"
        );
    }

    // =========================
    // 5️⃣ Generate Unique Slug
    // =========================
    const batchName = payload.name ?? payload.title;

    if (!batchName || typeof batchName !== "string") {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Batch name is required"
        );
    }

    const baseSlug = course.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await prisma.batch.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
    }

    // =========================
    // 6️⃣ Create Batch
    // =========================
    const batch = await prisma.batch.create({
        data: {
            name: batchName,
            slug,
            courseId: payload.courseId,
            enrollmentStart,
            enrollmentEnd,
            startDate,
            endDate,
            maxStudents: capacity,
            price: payload.price ?? 0,
            status: payload.status ?? BatchStatus.UPCOMING,
        },
        include: {
            course: true,
        },
    });

    return batch;
};

const getAllBatches = async () => {
    return prisma.batch.findMany({
        include: {
            course: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};
const getSingleBatch = async (id: string) => {

    const result = await prisma.batch.findUnique({
        where: { slug: id },

        include: {
            course: true,
        },

    });
    return result
};


const updateBatch = async (id: string, payload: any) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    return prisma.batch.update({
        where: { id },
        data: payload,
    });
};
const deleteBatch = async (id: string) => {
    const batch = await prisma.batch.findFirst({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    return prisma.batch.delete({
        where: { id }
    });
};


const toggleBatchStatus = async (id: string) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    // Toggle logic (you can adjust if needed)
    const newStatus =
        batch.status === BatchStatus.CANCELLED
            ? BatchStatus.UPCOMING
            : BatchStatus.CANCELLED;

    const updatedBatch = await prisma.batch.update({
        where: { id },
        data: {
            status: newStatus,
        },
    });

    return updatedBatch;
};

/* =========================
   Update Batch Status (Enum Based)
========================= */
const updateBatchStatus = async (
    id: string,
    status: BatchStatus
) => {
    const batch = await prisma.batch.findUnique({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    // Validate enum manually (extra safety)
    if (!Object.values(BatchStatus).includes(status)) {
        throw new Error("Invalid batch status");
    }

    const updatedBatch = await prisma.batch.update({
        where: { id },
        data: {
            status,
        },
    });

    return updatedBatch;
};


export const BatchService = {
    createBatch,
    getAllBatches,
    updateBatch,
    deleteBatch,
    getSingleBatch,
    toggleBatchStatus,
    updateBatchStatus
}
