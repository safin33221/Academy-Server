import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { paginationHelper } from "../../helper/paginationHelper.js";
import { IOptions } from "../../interface/pagination.js";
import { courseSearchableFields } from "./course.constant.js";



export const createCourse = async (payload: any) => {
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
    // 2️⃣ Meta Title
    // =========================

    const metaTitle =
        payload.metaTitle?.trim() || `${payload.title} | Premium Academy`;

    // =========================
    // 3️⃣ Access & Price Validation
    // =========================

    if (payload.access === "FREE") {
        payload.price = 0;
    }

    if (payload.access === "PAID") {
        if (!payload.price || payload.price <= 0) {
            throw new Error("Paid course must have price greater than 0");
        }
    }

    if (
        payload.discountPrice &&
        payload.price &&
        payload.discountPrice > payload.price
    ) {
        throw new Error("Discount price cannot be greater than price");
    }



    // =========================
    // 5️⃣ Extract Modules
    // =========================



    // =========================
    // 6️⃣ Create Course
    // =========================

    const course = await prisma.course.create({
        data: {
            ...payload,
            slug,
            metaTitle,

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
            AND: searchWords.map(word => ({
                OR: courseSearchableFields.map(field => ({
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

    // 💰 Price Range Filter
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

    // 📦 Query Data
    const [data, total] = await Promise.all([
        prisma.course.findMany({
            where: whereCondition,
            skip,
            take: limit,
            include: {
                modules: true,
                batches: true,
                coupons: true,
            },
            orderBy: sortBy && sortOrder
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


const getSingleCourse = async (id: string) => {
    return prisma.course.findUnique({
        where: { id },
        include: {
            modules: {
                include: {
                    lessons: true,
                },
            },
            // instructor: true,
            reviews: true,
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
    return prisma.course.update({
        where: { id },
        data: { approved: true },
    });
};

export const CourseService = {
    createCourse,
    getAllCourses,
    getSingleCourse,
    updateCourse,
    deleteCourse,
    approveCourse,
};
