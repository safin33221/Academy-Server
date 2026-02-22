import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { paginationHelper } from "../../helper/paginationHelper.js";
import { IOptions } from "../../interface/pagination.js";
import { courseSearchableFields } from "./course.constant.js";
import { fileUploader } from "../../helper/fileUploader.js";


/* eslint-disable @typescript-eslint/no-explicit-any */

const normalizeArrayField = (value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const toNumber = (value: any): number | null => {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
};

const toBoolean = (value: any): boolean => {
    return value === "true" || value === true;
};

export const createCourse = async (req: any) => {
    const file = req.file;
    const payload = req.body;

    // =========================
    // 1️⃣ Generate Unique Slug
    // =========================
    const baseSlug = payload.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await prisma.course.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
    }

    // =========================
    // 2️⃣ Upload Image
    // =========================
    let imageUrl: string | null = null;

    if (file) {
        const uploaded = await fileUploader.uploadToCloudinary(file);
        imageUrl = uploaded.secure_url;
    }

    // =========================
    // 3️⃣ Normalize Scalars
    // =========================
    const price = toNumber(payload.price);
    const discountPrice = toNumber(payload.discountPrice);
    const duration = toNumber(payload.duration);
    const totalClasses = toNumber(payload.totalClasses);

    const isPremium = toBoolean(payload.isPremium);
    const isFeatured = toBoolean(payload.isFeatured);

    // =========================
    // 4️⃣ Access & Price Validation
    // =========================
    if (payload.access === "FREE") {
        if (price !== null && price !== 0) {
            throw new Error("Free course must have price 0");
        }
    }

    if (payload.access === "PAID") {
        if (!price || price <= 0) {
            throw new Error("Paid course must have price greater than 0");
        }
    }

    if (
        discountPrice !== null &&
        price !== null &&
        discountPrice > price
    ) {
        throw new Error("Discount price cannot be greater than price");
    }

    // =========================
    // 5️⃣ Extract Nested Fields
    // =========================
    const normalizedCurriculum = normalizeArrayField(payload.curriculum);
    const normalizedLearnings = normalizeArrayField(payload.learnings);
    const normalizedFaqs = normalizeArrayField(payload.faqs);

    // =========================
    // 6️⃣ Create Course
    // =========================
    const course = await prisma.course.create({
        data: {
            title: payload.title,
            slug,
            shortDescription: payload.shortDescription,
            fullDescription: payload.fullDescription,
            level: payload.level,
            category: payload.category || "",

            price: price ?? 0,
            discountPrice,
            duration: duration ?? 0,
            totalClasses: totalClasses ?? 0,

            isPremium,
            isFeatured,
            thumbnail: imageUrl,

            curriculum: normalizedCurriculum.length
                ? {
                    create: normalizedCurriculum.map(
                        (item: any, index: number) => ({
                            title: item.title,
                            content: item.content,
                            order: item.order ?? index + 1,
                        })
                    ),
                }
                : undefined,

            learnings: normalizedLearnings.length
                ? {
                    create: normalizedLearnings.map((item: any) => ({
                        content: item.content,
                    })),
                }
                : undefined,

            faqs: normalizedFaqs.length
                ? {
                    create: normalizedFaqs.map((item: any) => ({
                        question: item.question,
                        answer: item.answer,
                    })),
                }
                : undefined,
        },
        include: {
            curriculum: true,
            learnings: true,
            faqs: true,
        },
    });

    return course;
};


const getAllCourses = async (options: IOptions, params: any) => {
    const { page, skip, limit, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    const { searchTerm, minPrice, maxPrice, ...filterData } = params;

    const normalizedSearchTerm =
        typeof searchTerm === "string"
            ? searchTerm.trim().replace(/^["']|["']$/g, "")
            : undefined;

    const andConditions: Prisma.CourseWhereInput[] = [];

    // 🔎 Search Logic
    if (normalizedSearchTerm) {
        const searchWords = normalizedSearchTerm.split(/\s+/);

        andConditions.push({
            AND: searchWords.map((word) => ({
                OR: courseSearchableFields.map((field) => ({
                    [field]: {
                        contains: word,
                        mode: "insensitive",
                    },
                })),
            })),
        });
    }

    // 🎯 Filter Logic
    if (Object.keys(filterData).length) {
        andConditions.push({
            AND: Object.entries(filterData).map(([field, value]) => ({
                [field]: value,
            })),
        });
    }

    // 💰 Price Filter
    if (minPrice || maxPrice) {
        andConditions.push({
            price: {
                gte: minPrice ? Number(minPrice) : undefined,
                lte: maxPrice ? Number(maxPrice) : undefined,
            },
        });
    }

    const whereCondition: Prisma.CourseWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const [data, total] = await Promise.all([
        prisma.course.findMany({
            where: { ...whereCondition, isDeleted: false },
            skip,
            take: limit,

            include: {
                curriculum: true,
                learnings: true,
                requirements: true,
                faqs: true,
                reviews: true,
            },

            orderBy:
                sortBy && sortOrder
                    ? { [sortBy]: sortOrder }
                    : { createdAt: "desc" },
        }),

        prisma.course.count({
            where: whereCondition,
        }),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data,
    };
};

const getSingleCourse = async (slug: string) => {
    return prisma.course.findUnique({
        where: { slug },
        include: {
            curriculum: {
                orderBy: { order: "asc" },
            },
            learnings: true,
            requirements: true,
            reviews: true,
            faqs: true,
        },
    });
};

const updateCourse = async (id: string, payload: any) => {
    return prisma.course.update({
        where: { id },
        data: payload,
    });
};

const deleteCourse = async (id: string) => {
    return prisma.course.update({
        where: { id },
        data: { isDeleted: true },
    });
};

const approveCourse = async (id: string) => {
    return
};

export const CourseService = {
    createCourse,
    getAllCourses,
    getSingleCourse,
    updateCourse,
    deleteCourse,
    approveCourse,
};
