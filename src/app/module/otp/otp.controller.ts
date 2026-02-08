import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import { OtpService } from "./otp.service.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";


const sendOtp = catchAsync(async (req: Request, res: Response) => {
    await OtpService.sendOtp(req.body);

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "OTP sent to email",
    });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
    await OtpService.verifyOtp(req.body);

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Email verified successfully",
    });
});

export const OtpController: any = {
    sendOtp,
    verifyOtp,
};
