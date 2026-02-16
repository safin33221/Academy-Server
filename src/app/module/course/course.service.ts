import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { paginationHelper } from "../../helper/paginationHelper.js";
import { IOptions } from "../../interface/pagination.js";
import { courseSearchableFields } from "./course.constant.js";


export const createCourse = async (payload: any) => {
    // =========================
    // 1️⃣ Generate Unique Slug
    // =========================
    console.log({ payload });
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
    // 4️⃣ Extract Nested Data
    // =========================

    const {
        curriculum = [],
        learnings = [],
        faqs = [],
        ...courseData
    } = payload;

    // =========================
    // 5️⃣ Create Course (Nested)
    // =========================

    const course = await prisma.course.create({
        data: {
            ...courseData,
            slug,


            curriculum: curriculum.length
                ? {
                    create: curriculum.map((item: any, index: number) => ({
                        title: item.title,
                        content: item.content,
                        order: item.order ?? index + 1,
                    })),
                }
                : undefined,

            learnings: learnings.length
                ? {
                    create: learnings.map((item: any) => ({
                        content: item.content,
                    })),
                }
                : undefined,

            faqs: faqs.length
                ? {
                    create: faqs.map((item: any) => ({
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
            where: whereCondition,
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
