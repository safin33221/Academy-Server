import { Request, Response, NextFunction } from "express";
import catchAsync from "../../shared/catchAsync.js";
import { AuthService } from "./auth.service.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";


/**
 * LOGIN
 */
const login = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const result = await AuthService.login(req.body);

        const { accessToken, refreshToken, user } = result;

        res.cookie("accessToken", accessToken, {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "none",
            maxAge: 1000 * 60 * 60, // 1 hour
        });

        res.cookie("refreshToken", refreshToken, {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "none",
            maxAge: 1000 * 60 * 60 * 24 * 90, // 90 days
        });

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Login successful",
            data: user,
        });
    }
);

/**
 * REGISTER
 */
const register = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const user = await AuthService.register(req.body);

        sendResponse(res, {
            status: httpCode.CREATED,
            success: true,
            message: "Registration successful",
            data: user,
        });
    }
);

/**
 * REFRESH TOKEN
 */
const refreshToken = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const token = req.cookies?.refreshToken;

        const result = await AuthService.refreshAccessToken(token);

        res.cookie("accessToken", result.accessToken, {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "none",
            maxAge: 1000 * 60 * 60,
        });

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Token refreshed successfully",
        });
    }
);

/**
 * LOGOUT
 */
const logout = catchAsync(
    async (_req: Request, res: Response, _next: NextFunction) => {
        res.clearCookie("accessToken", {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "none",
        });

        res.clearCookie("refreshToken", {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "none",
        });

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Logout successful",
        });
    }
);




export const AuthController: any = {
    login,
    register,
    refreshToken,
    logout
};
