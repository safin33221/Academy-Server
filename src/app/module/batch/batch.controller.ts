import httpCode from "http-status";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { BatchService } from "./batch.service.js";
import { Request, Response } from "express";

/* =========================
   Create Batch
========================= */
const createBatch = catchAsync(
    async (req: Request, res: Response) => {

        const result = await BatchService.createBatch(req);

        sendResponse(res, {
            status: httpCode.CREATED,
            success: true,
            message: "Batch created successfully",
            data: result,
        });
    }
);

/* =========================
   Update Batch
========================= */
const updateBatch = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const result = await BatchService.updateBatch(id, req);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batch updated successfully",
            data: result,
        });
    }
);

/* =========================
   Delete Batch
========================= */
const deleteBatch = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const result = await BatchService.deleteBatch(id);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batch deleted successfully",
            data: result,
        });
    }
);

/* =========================
   Get All Batches
========================= */
const getAllBatches = catchAsync(
    async (req: Request, res: Response) => {
        const result = await BatchService.getAllBatches();

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batches retrieved successfully",
            data: result,
        });
    }
);

/* =========================
   Get Single Batch
========================= */
const getSingleBatch = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const result = await BatchService.getSingleBatch(id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batch retrieved successfully",
            data: result,
        });
    }
);



const getPublicBatches = catchAsync(
    async (req: Request, res: Response) => {

        const result = await BatchService.getPublicBatches();

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Public Batch retrieved successfully",
            data: result,
        });
    }
);




const getInstructorBatches = catchAsync(
    async (req: Request, res: Response) => {
        const instructorId = req?.user?.id;

        const result = await BatchService.getInstructorBatches(
            instructorId as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Instructor batches retrieved successfully",
            data: result,
        });
    }
);

export const BatchController = {
    createBatch,
    updateBatch,
    deleteBatch,
    getAllBatches,
    getSingleBatch,
    getPublicBatches,
    getInstructorBatches
};