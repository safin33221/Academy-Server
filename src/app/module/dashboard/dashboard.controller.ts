import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import { DashboardService } from "./dashboard.service.js";

const getDashboardOverview = catchAsync(async (_req: Request, res: Response) => {
    const result = await DashboardService.getDashboardOverview();

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Dashboard overview retrieved successfully",
        data: result,
    });
});

export const DashboardController = {
    getDashboardOverview,
};
