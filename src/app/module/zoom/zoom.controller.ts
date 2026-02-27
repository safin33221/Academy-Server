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
        });

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Zoom meeting created successfully",
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
    handleZoomWebhook,
};
