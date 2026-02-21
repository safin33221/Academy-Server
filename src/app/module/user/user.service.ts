


import prisma from "../../../lib/prisma.js";
import { paginationHelper } from "../../helper/paginationHelper.js";
import { IOptions } from "../../interface/pagination.js";
import { Prisma } from "@prisma/client";
import { userSearchableField } from "./user.constant.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { fileUploader } from "../../helper/fileUploader.js";



const getMe = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
            isVerified: true,
            lastLoginAt: true,
            profilePhoto: true

        },
    });

    if (!user) {
        throw new ApiError(httpCode.NOT_FOUND, "User not found");
    }

    return user;
};

const getAllUsers = async (options: IOptions, params: any) => {
    const { page, limit, skip, sortBy } =
        paginationHelper.calculatePagination(options);

    const { searchTerm, ...filterData } = params;

    const normalizedSearchTerm =
        typeof searchTerm === "string"
            ? searchTerm.trim().replace(/^["']|["']$/g, "")
            : undefined;

    const andCondition: Prisma.UserWhereInput[] = [];

    /* 🔍 SEARCH (multi-word, multi-field) */
    if (normalizedSearchTerm) {
        const searchWords = normalizedSearchTerm.split(/\s+/);

        andCondition.push({
            AND: searchWords.map(word => ({
                OR: userSearchableField.map(field => ({
                    [field]: {
                        contains: word,
                        mode: "insensitive",
                    },
                })),
            })),
        });
    }


    if (Object.keys(filterData).length > 0) {
        andCondition.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    const whereCondition: Prisma.UserWhereInput =
        andCondition.length > 0 ? { AND: andCondition } : {};

    const orderBy =
        options.sortBy && options.sortOrder
            ? { [options.sortBy]: options.sortOrder }
            : { createdAt: "desc" };

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereCondition,
            skip,
            take: limit,
            // orderBy: sortBy || '',
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
                isDeleted: true,
                isBlocked: true,
                phone: true,
                lastLoginAt: true,
                profilePhoto: true
            },
        }),
        prisma.user.count({
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
        data: users,
    };
};

const getSingleUser = async (id: string) => {
    return prisma.user.findFirst({
        where: { id, isDeleted: false },
    });
};

const updateUser = async (
    id: string,
    req: any
) => {
    const file = req.file;

    // 1️⃣ Prepare update payload safely
    const allowedFields: Prisma.UserUpdateInput = {
        name: req.body.name,
        phone: req.body.phone,
    };

    // 2️⃣ Handle profile image upload
    let imageUrl = null
    if (file) {
        const uploaded =
            await fileUploader.uploadToCloudinary(file);
        console.log({ uploaded });
        imageUrl =
            uploaded.secure_url;
    }
    console.log({ imageUrl });



    // 4️⃣ Update user
    return prisma.user.update({
        where: { id },
        data: {
            ...allowedFields,
            profilePhoto: imageUrl
        },
    });
};

const toggleUserBlockStatus = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: { isBlocked: true },
    });

    if (!user) {
        throw new Error("User not found");
    }

    return prisma.user.update({
        where: { id },
        data: {
            isBlocked: !user.isBlocked,
            isActive: user.isBlocked, // active when unblocked
        },
    });
};

export const UserService = {
    getMe,
    getAllUsers,
    getSingleUser,
    updateUser,
    toggleUserBlockStatus,
};
