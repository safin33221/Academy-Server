import { Request, Response, NextFunction } from "express";
import httpCode from "http-status";
import { UserService } from "./user.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";

const getAllUsers = catchAsync(async (req, res) => {
    const result = await UserService.getAllUsers(req.query);

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Users retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});


const getSingleUser = catchAsync(
    async (req: Request, res: Response) => {
        const user = await UserService.getSingleUser(req.params.id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "User retrieved successfully",
            data: user,
        });
    }
);

const updateUser = catchAsync(
    async (req: Request, res: Response) => {
        const user = await UserService.updateUser(req.params.id as string, req.body);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "User updated successfully",
            data: user,
        });
    }
);

const deleteUser = catchAsync(
    async (req: Request, res: Response) => {
        await UserService.softDeleteUser(req.params.id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "User deleted successfully",
        });
    }
);

export const UserController = {
    getAllUsers,
    getSingleUser,
    updateUser,
    deleteUser,
};
