import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import { zoomService } from "./zoom.service.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";

const createZoomMeeting = catchAsync(
    async (req: Request, res: Response) => {
        const result = await zoomService.createZoomMeeting({
            topic: req.body.topic,
            startTime: new Date(req.body.startTime),
            duration: req.body.duration,
            batchClassId: req.body.batchClassId,
        });

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Zoom meeting created successfully",
            data: result,
        });
    }
);

const createMeetingRegistration = catchAsync(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const meetingId = req.params.meetingId;

        const result = await zoomService.createRegistrationForUser(
            meetingId,
            userId as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Meeting registration completed successfully",
            data: result,
        });
    }
);

const syncAttendanceAfterMeeting = catchAsync(
    async (req: Request, res: Response) => {
        const result = await zoomService.syncAttendanceAfterMeeting(
            req.params.meetingId
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Attendance sync completed successfully",
            data: result,
        });
    }
);

const getMeetingAttendance = catchAsync(
    async (req: Request, res: Response) => {
        const result = await zoomService.getMeetingAttendanceReport(
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
    }
);

const getBatchClassAttendance = catchAsync(
    async (req: Request, res: Response) => {
        const result = await zoomService.getBatchClassAttendanceReport(
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
        const result = await zoomService.getMyBatchClassAttendance(
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

const handleZoomWebhook = catchAsync(
    async (req: Request, res: Response) => {
        const result = await zoomService.processZoomWebhook(req);
        res.status(result.statusCode).json(result.body);
    }
);

export const ZoomController = {
    createZoomMeeting,
    createMeetingRegistration,
    syncAttendanceAfterMeeting,
    getMeetingAttendance,
    getBatchClassAttendance,
    getMyBatchClassAttendance,
    handleZoomWebhook,
};
