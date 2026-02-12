
import { IUserUpdatePayload } from "./user.interface.js";


import prisma from "../../../lib/prisma.js";
import { paginationHelper } from "../../helper/paginationHelper.js";
import { IOptions } from "../../interface/pagination.js";
import { Prisma } from "@prisma/client";
import { userSearchableField } from "./user.constant.js";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";



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

const updateUser = async (id: string, payload: IUserUpdatePayload) => {
    return prisma.user.update({
        where: { id },
        data: payload,
        select: {
            id: true,
            name: true,

            email: true,
            role: true,
            isActive: true,
        },
    });
};

const softDeleteUser = async (id: string) => {
    return prisma.user.update({
        where: { id },
        data: { isDeleted: true },
    });
};

export const UserService = {
    getMe,
    getAllUsers,
    getSingleUser,
    updateUser,
    softDeleteUser,
};
