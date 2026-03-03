import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import { attendanceService } from "./attendance.service.js";

const getMeetingAttendance = catchAsync(async (req: Request, res: Response) => {
    const result = await attendanceService.getMeetingAttendanceReport(
        req.params.meetingId,
        {
            id: req.user?.id as string,
            role: req.user?.role as string,
        }
    );

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Meeting attendance retrieved successfully",
        data: result,
    });
});

const getBatchClassAttendance = catchAsync(
    async (req: Request, res: Response) => {
        const result = await attendanceService.getBatchClassAttendanceReport(
            req.params.classId,
            {
                id: req.user?.id as string,
                role: req.user?.role as string,
            }
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Class attendance report retrieved successfully",
            data: result,
        });
    }
);

const getMyBatchClassAttendance = catchAsync(
    async (req: Request, res: Response) => {
        const result = await attendanceService.getMyBatchClassAttendance(
            req.params.classId,
            req.user?.id as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "My attendance retrieved successfully",
            data: result,
        });
    }
);

const getMyBatchAttendanceByBatch = catchAsync(
    async (req: Request, res: Response) => {
        const result = await attendanceService.getMyBatchAttendanceByBatch(
            req.params.batchId,
            req.user?.id as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "My batch attendance retrieved successfully",
            data: result,
        });
    }
);

export const AttendanceController = {
    getMeetingAttendance,
    getBatchClassAttendance,
    getMyBatchClassAttendance,
    getMyBatchAttendanceByBatch,
};
