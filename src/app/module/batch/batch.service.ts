import { BatchStatus } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { fileUploader } from "../../helper/fileUploader.js";

/* ============================================================================
   UTILITY FUNCTIONS
============================================================================ */

/**
 * Normalizes instructor IDs from various input formats (array, JSON string, comma-separated)
 */
const normalizeInstructorIds = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value !== "string") return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    // Try parsing as JSON
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
    } catch {
        // Not JSON, continue to comma splitting
    }

    // Fallback to comma-separated values
    return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
};

/**
 * Generates a unique slug from course title and batch name
 */
const generateBatchSlug = (courseTitle: string, batchName: string): string => {
    const courseSlug = courseTitle
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    const batchSlug = batchName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    return `${courseSlug}-${batchSlug}`;
};

/**
 * Validates date range logic
 */
const validateDateRange = (start: Date, end?: Date | null): void => {
    if (end && start >= end) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "End date must be greater than start date"
        );
    }
};

/**
 * Validates enrollment period logic
 */
const validateEnrollmentPeriod = (start: Date, end: Date): void => {
    if (start > end) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Enrollment end date must be greater than enrollment start date"
        );
    }
};

/**
 * Validates capacity
 */
const validateCapacity = (capacity: number): void => {
    if (!Number.isFinite(capacity) || capacity <= 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Capacity must be greater than 0"
        );
    }
};

/**
 * Validates price
 */
const validatePrice = (price?: number): void => {
    if (price !== undefined && price < 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Price cannot be negative"
        );
    }
};

/**
 * Validates and returns parsed date
 */
const parseDate = (dateStr: string | undefined, fieldName: string): Date | null => {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            `Invalid ${fieldName}`
        );
    }
    return date;
};

/**
 * Validates instructors exist and have correct role
 */
const validateInstructors = async (instructorIds: string[]): Promise<void> => {
    if (instructorIds.length === 0) return;

    const validInstructors = await prisma.user.findMany({
        where: {
            id: { in: instructorIds },
            role: "INSTRUCTOR",
        },
        select: { id: true },
    });

    if (validInstructors.length !== instructorIds.length) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "One or more instructors are invalid"
        );
    }
};

/* ============================================================================
   CREATE BATCH
============================================================================ */

const createBatch = async (req: any) => {
    const file = req.file;
    const payload = req.body;

    // Process instructor IDs
    const instructorIds = Array.from(
        new Set(
            normalizeInstructorIds(
                payload.instructorIds ?? payload.instructors
            )
        )
    );

    // Validate course exists
    if (!payload.courseId) {
        throw new ApiError(httpCode.BAD_REQUEST, "Course ID is required");
    }

    const course = await prisma.course.findUnique({
        where: { id: payload.courseId },
    });

    if (!course) {
        throw new ApiError(httpCode.NOT_FOUND, "Course not found");
    }

    // Validate batch name
    const batchName = payload.name ?? payload.title;
    if (!batchName || typeof batchName !== "string") {
        throw new ApiError(httpCode.BAD_REQUEST, "Batch name is required");
    }

    // Parse and validate dates
    const startDate = parseDate(payload.startDate, "start date")!;
    const endDate = parseDate(payload.endDate, "end date");

    validateDateRange(startDate, endDate);

    const enrollmentStart = parseDate(
        payload.enrollmentStart,
        "enrollment start date"
    ) ?? startDate;

    const enrollmentEnd = parseDate(
        payload.enrollmentEnd,
        "enrollment end date"
    ) ?? endDate ?? startDate;

    validateEnrollmentPeriod(enrollmentStart, enrollmentEnd);

    // Validate capacity and price
    const capacity = Number(payload.capacity ?? payload.maxStudents);
    validateCapacity(capacity);

    const price = payload.price ? Number(payload.price) : 0;
    validatePrice(price);

    // Generate slug
    const slug = generateBatchSlug(course.title, batchName);

    // Upload image if provided
    let imageUrl = null;
    if (file) {
        const uploaded = await fileUploader.uploadToCloudinary(file);
        imageUrl = uploaded.secure_url;
    }

    // Validate instructors
    await validateInstructors(instructorIds);

    // Create batch
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
            price,
            status: payload.status ?? BatchStatus.UPCOMING,
            thumbnail: imageUrl,
            videoURL: payload.videoURL || "",
            instructors: instructorIds.length
                ? { connect: instructorIds.map((id: string) => ({ id })) }
                : undefined,
        },
        include: {
            course: true,
            instructors: true,
        },
    });

    return batch;
};

/* ============================================================================
   UPDATE BATCH
============================================================================ */

const updateBatch = async (id: string, req: any) => {
    const payload = req.body;
    const file = req.file;
    const hasInstructorField = payload?.instructorIds !== undefined || payload?.instructors !== undefined;

    // Check if batch exists
    const existingBatch = await prisma.batch.findUnique({
        where: { id },
        include: {
            course: true,
            instructors: true,
        },
    });

    if (!existingBatch) {
        throw new ApiError(httpCode.NOT_FOUND, "Batch not found");
    }

    // Process instructor IDs if provided
    const instructorIds = hasInstructorField
        ? Array.from(
            new Set(
                normalizeInstructorIds(
                    payload.instructorIds ?? payload.instructors
                )
            )
        )
        : [];

    if (hasInstructorField && instructorIds.length > 0) {
        await validateInstructors(instructorIds);
    }

    // Validate course if changed
    let courseId = existingBatch.courseId;
    if (payload.courseId && payload.courseId !== existingBatch.courseId) {
        const course = await prisma.course.findUnique({
            where: { id: payload.courseId },
        });

        if (!course) {
            throw new ApiError(httpCode.NOT_FOUND, "Course not found");
        }

        courseId = payload.courseId;
    }

    // Parse and validate dates
    const startDate = payload.startDate
        ? parseDate(payload.startDate, "start date")!
        : existingBatch.startDate;

    const endDate = payload.endDate
        ? parseDate(payload.endDate, "end date")
        : existingBatch.endDate;

    validateDateRange(startDate, endDate);

    const enrollmentStart = payload.enrollmentStart
        ? parseDate(payload.enrollmentStart, "enrollment start date")!
        : existingBatch.enrollmentStart;

    const enrollmentEnd = payload.enrollmentEnd
        ? parseDate(payload.enrollmentEnd, "enrollment end date")!
        : existingBatch.enrollmentEnd;

    validateEnrollmentPeriod(enrollmentStart, enrollmentEnd);

    // Validate capacity
    const capacity = payload.maxStudents
        ? Number(payload.maxStudents)
        : existingBatch.maxStudents;

    validateCapacity(capacity);

    if (capacity < existingBatch.enrolledCount) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Capacity cannot be less than enrolled students"
        );
    }

    // Validate price
    const price = payload.price !== undefined
        ? Number(payload.price)
        : existingBatch.price;

    validatePrice(price!);

    // Regenerate slug if name changed
    let slug = existingBatch.slug;
    if (payload.name && payload.name !== existingBatch.name) {
        const course = await prisma.course.findUnique({
            where: { id: courseId },
        });
        slug = generateBatchSlug(course!.title, payload.name);
    }

    // Upload new image if provided
    let imageUrl = existingBatch.thumbnail;
    if (file) {
        const uploaded = await fileUploader.uploadToCloudinary(file);
        imageUrl = uploaded.secure_url;
    }

    // Update batch
    const updatedBatch = await prisma.batch.update({
        where: { id },
        data: {
            name: payload.name ?? existingBatch.name,
            slug,
            courseId,
            enrollmentStart,
            enrollmentEnd,
            startDate,
            endDate,
            maxStudents: capacity,
            price,
            status: payload.status ?? existingBatch.status,
            isActive:
                payload.isActive !== undefined
                    ? payload.isActive === "true" || payload.isActive === true
                    : existingBatch.isActive,
            thumbnail: imageUrl,
            videoURL: payload.videoURL ?? existingBatch.videoURL,
            instructors: hasInstructorField
                ? { set: instructorIds.map((id: string) => ({ id })) }
                : undefined,
        },
        include: {
            course: true,
            instructors: true,
        },
    });

    return updatedBatch;
};

/* ============================================================================
   GET BATCHES
============================================================================ */

const getAllBatches = async () => {
    return prisma.batch.findMany({
        include: {
            course: true,
            instructors: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

const getSingleBatch = async (slug: string) => {
    const result = await prisma.batch.findUnique({
        where: { slug },
        include: {
            course: {
                include: {
                    curriculum: { orderBy: { order: "asc" } },
                    learnings: true,
                    requirements: true,
                    faqs: true,
                    reviews: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
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
            instructors: true,
        },
    });

    return result;
};

const getInstructorBatches = async (id: string) => {
    // Validate instructor exists
    const instructor = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
    });

    if (!instructor) {
        throw new ApiError(httpCode.NOT_FOUND, "Instructor not found");
    }

    // Get batches where instructor is assigned
    const batches = await prisma.batch.findMany({
        where: {
            instructors: { some: { id } },
            isDeleted: false,
        },
        include: {
            course: {
                select: { id: true, title: true, slug: true },
            },
            instructors: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return batches;
};

/* ============================================================================
   DELETE / STATUS MANAGEMENT
============================================================================ */

const deleteBatch = async (id: string) => {
    const batch = await prisma.batch.findFirst({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    return prisma.batch.update({
        where: { id },
        data: { isDeleted: true },
    });
};


/* ============================================================================
   EXPORTS
============================================================================ */

export const BatchService = {
    createBatch,
    getAllBatches,
    updateBatch,
    deleteBatch,
    getSingleBatch,

    getInstructorBatches,
};