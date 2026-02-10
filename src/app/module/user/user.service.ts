
import { IUserUpdatePayload } from "./user.interface.js";


import prisma from "../../../lib/prisma.js";

interface IPaginationOptions {
    page?: number;
    limit?: number;
}

const getAllUsers = async (options: IPaginationOptions) => {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;
    const skip = (page - 1) * limit;

    const whereCondition = { isDeleted: false };

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where: whereCondition,
            skip,
            take: limit,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                isActive: true,
                isVerified: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
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
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
        },
    });
};

const softDeleteUser = async (id: string) => {
    return prisma.user.update({
        where: { id },
        data: { isDelete: true },
    });
};

export const UserService = {
    getAllUsers,
    getSingleUser,
    updateUser,
    softDeleteUser,
};
