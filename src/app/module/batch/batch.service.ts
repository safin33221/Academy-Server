import { BatchStatus } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { fileUploader } from "../../helper/fileUploader.js";

const normalizeStringArrayField = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item).trim())
            .filter(Boolean);
    }

    if (typeof value !== "string") return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => String(item).trim())
                .filter(Boolean);
        }
    } catch {
        // Fall back to comma-separated values
    }

    return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const createBatch = async (req: any) => {
    const file = req.file;
    const payload = req.body;
    console.log({ payload });

    // ✅ Handle multiple instructor IDs
    const instructorIds = Array.from(
        new Set(
            normalizeStringArrayField(
                payload.instructorIds ?? payload.instructors
            )
        )
    );

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

    // =========================
    // 5️⃣ Generate Slug
    // =========================
    const batchName = payload.name ?? payload.title;

    if (!batchName || typeof batchName !== "string") {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Batch name is required"
        );
    }

    const courseSlug = course.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    const batchSlug = batchName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    const slug = `${courseSlug}-${batchSlug}`;

    // =========================
    // 6️⃣ Upload Image
    // =========================
    let imageUrl = null;

    if (file) {
        const uploaded = await fileUploader.uploadToCloudinary(file);
        imageUrl = uploaded.secure_url;
    }

    // =========================
    // 7️⃣ Validate Instructors (Optional but Recommended)
    // =========================
    if (instructorIds.length > 0) {
        const validInstructors = await prisma.user.findMany({
            where: {
                id: { in: instructorIds },
                role: "INSTRUCTOR", // optional role check
            },
            select: { id: true },
        });

        if (validInstructors.length !== instructorIds.length) {
            throw new ApiError(
                httpCode.BAD_REQUEST,
                "One or more instructors are invalid"
            );
        }
    }

    // =========================
    // 8️⃣ Create Batch
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
            price: payload.price ? Number(payload.price) : 0,
            status: payload.status ?? BatchStatus.UPCOMING,
            thumbnail: imageUrl,
            videoURL: payload.videoURL || "",

            // ✅ Instructor Relation
            instructors: instructorIds.length
                ? {
                    connect: instructorIds.map((id: string) => ({ id })),
                }
                : undefined,
        },
        include: {
            course: true,
            instructors: true,
        },
    });

    return batch;
};
const updateBatch = async (id: string, req: any) => {
    const payload = req.body;
    const file = req.file;
    const hasInstructorField =
        payload?.instructorIds !== undefined ||
        payload?.instructors !== undefined;

    // =========================
    // 1️⃣ Check Batch Exists
    // =========================
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

    // =========================
    // 2️⃣ Normalize Instructor IDs
    // =========================
    const instructorIds = hasInstructorField
        ? Array.from(
            new Set(
                normalizeStringArrayField(
                    payload.instructorIds ?? payload.instructors
                )
            )
        )
        : [];

    // Validate instructors if provided
    if (hasInstructorField && instructorIds.length > 0) {
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
    }

    // =========================
    // 3️⃣ Validate Course (if changed)
    // =========================
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

    // =========================
    // 4️⃣ Date Validation
    // =========================
    const startDate = payload.startDate
        ? new Date(payload.startDate)
        : existingBatch.startDate;

    const endDate = payload.endDate
        ? new Date(payload.endDate)
        : existingBatch.endDate;

    if (Number.isNaN(new Date(startDate).getTime())) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid start date");
    }

    if (endDate && Number.isNaN(new Date(endDate).getTime())) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid end date");
    }

    if (endDate && startDate >= endDate) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "End date must be greater than start date"
        );
    }

    const enrollmentStart = payload.enrollmentStart
        ? new Date(payload.enrollmentStart)
        : existingBatch.enrollmentStart;

    const enrollmentEnd = payload.enrollmentEnd
        ? new Date(payload.enrollmentEnd)
        : existingBatch.enrollmentEnd;

    if (enrollmentStart > enrollmentEnd) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Enrollment end date must be greater than enrollment start date"
        );
    }

    // =========================
    // 5️⃣ Capacity Validation
    // =========================
    const capacity = payload.maxStudents
        ? Number(payload.maxStudents)
        : existingBatch.maxStudents;

    if (!Number.isFinite(capacity) || capacity <= 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Capacity must be greater than 0"
        );
    }

    if (capacity < existingBatch.enrolledCount) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Capacity cannot be less than enrolled students"
        );
    }

    // =========================
    // 6️⃣ Price Validation
    // =========================
    const price =
        payload.price !== undefined
            ? Number(payload.price)
            : existingBatch.price;

    if (price! < 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Price cannot be negative"
        );
    }

    // =========================
    // 7️⃣ Slug Regeneration
    // =========================
    let slug = existingBatch.slug;

    if (payload.name && payload.name !== existingBatch.name) {
        const course = await prisma.course.findUnique({
            where: { id: courseId },
        });

        const courseSlug = course!.title
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, "");

        const batchSlug = payload.name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, "");

        slug = `${courseSlug}-${batchSlug}`;
    }

    // =========================
    // 8️⃣ Image Replace
    // =========================
    let imageUrl = existingBatch.thumbnail;

    if (file) {
        const uploaded = await fileUploader.uploadToCloudinary(file);
        imageUrl = uploaded.secure_url;
    }

    // =========================
    // 9️⃣ Update Batch
    // =========================
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

            // ✅ IMPORTANT: Replace instructors completely
            instructors: hasInstructorField
                ? {
                    set: instructorIds.map((id: string) => ({ id })),
                }
                : undefined,
        },
        include: {
            course: true,
            instructors: true,
        },
    });

    return updatedBatch;
};

const getAllBatches = async () => {
    return prisma.batch.findMany({
        include: {
            course: true,
            instructors: true

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
                    curriculum: {
                        orderBy: { order: "asc" },
                    },
                    learnings: true,
                    requirements: true,
                    faqs: true,
                    reviews: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,

                                },
                            },
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
                    }
                }
            },
            instructors: true
        },
    });

    return result;
};


const deleteBatch = async (id: string) => {
    const batch = await prisma.batch.findFirst({
        where: { id },
    });

    if (!batch) {
        throw new Error("Batch not found");
    }

    return prisma.batch.update({
        where: { id },
        data: { isDeleted: true }
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

const getInstructorBatches = async (id: string) => {
    // =========================
    // 1️⃣ Validate Instructor
    // =========================
    const instructor = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
    });

    if (!instructor) {
        throw new ApiError(httpCode.NOT_FOUND, "Instructor not found");
    }



    // =========================
    // 2️⃣ Get Instructor Batches
    // =========================
    const batches = await prisma.batch.findMany({
        where: {
            instructors: {
                some: { id }, // Many-to-Many filter
            },
            isDeleted: false,
        },
        include: {
            course: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                },
            },
            instructors: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return batches;
};



export const BatchService = {
    createBatch,
    getAllBatches,
    updateBatch,
    deleteBatch,
    getSingleBatch,
    toggleBatchStatus,
    updateBatchStatus,
    getInstructorBatches
}
