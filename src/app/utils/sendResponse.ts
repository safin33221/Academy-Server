import type { Response } from "express";

interface SendableResponse {
    status(code: number): Response;
}

const sendResponse = <T>(res: SendableResponse, jsonData: {
    status: number,
    success: boolean,
    message: string,
    meta?: {
        page: number,
        limit: number,
        total: number
    },
    data?: T | null | undefined;

}) => {
    res.status(jsonData.status).json({
        status: jsonData.status,
        success: jsonData.success,
        message: jsonData.message,
        data: jsonData.data || null || undefined,
        meta: jsonData.meta || null || undefined

    })
}

export default sendResponse
