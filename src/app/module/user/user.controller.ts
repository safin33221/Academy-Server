import httpCode from "http-status";
import { UserService } from "./user.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../utils/pick.js";
import { userFilterableField } from "./user.constant.js";
import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";


const getMe = catchAsync(async (req: Request, res: Response) => {
    const id = req.user?.id

    const result = await UserService.getMe(id as string);

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Users retrieved successfully",
        data: result,
    });
})
const getAllUsers = catchAsync(async (req, res) => {
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder'])
    const filters = pick(req.query, userFilterableField)
    console.log({ filters, options });

    const result = await UserService.getAllUsers(options, filters);

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Users retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});


const getSingleUser = catchAsync(
    async (req, res) => {
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
    async (req, res) => {

        const user = await UserService.updateUser(req.params.id as string, req.body);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "User updated successfully",
            data: user,
        });
    }
);

const toggleUserBlockStatus = catchAsync(
    async (req, res) => {
        const result = await UserService.toggleUserBlockStatus(req.params.id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: result.isBlocked
                ? "User blocked successfully"
                : "User unblocked successfully",

        });
    }
);

export const UserController = {
    getMe,
    getAllUsers,
    getSingleUser,
    updateUser,
    toggleUserBlockStatus,
};
