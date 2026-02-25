import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import { batchClassService } from "./batchClass.service.js";


const createClass = catchAsync(async (req: Request, res: Response) => {

    const result = await batchClassService.createClass(
        req.user,
        req.body
    );

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Class created successfully",
        data: result,
    });
});


const getStudentClasses = catchAsync(async (req: Request, res: Response) => {

    const result = await batchClassService.getStudentClasses(
        req?.user?.id as string
    );

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Classes retrieved successfully",
        data: result,
    });
});


export const BatchClassController = {
    createClass,
    getStudentClasses,
};