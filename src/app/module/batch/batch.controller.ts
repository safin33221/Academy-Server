import httpCode from "http-status";
import catchAsync from "../../utils/catchAsync.js";
import sendResponse from "../../utils/sendResponse.js";
import { BatchService } from "./batch.service.js";
import { string } from "zod";

/* =========================
   Create Batch
========================= */
const createBatch = catchAsync(
    async (req, res) => {

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
    async (req, res) => {
        const { id } = req.params;

        const result = await BatchService.updateBatch(id, req.body);

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
    async (req, res) => {
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
    async (req, res) => {
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
    async (req, res) => {
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

/* =========================
   Toggle Active
========================= */
const toggleBatchStatus = catchAsync(
    async (req, res) => {
        const { id } = req.params;

        const result = await BatchService.toggleBatchStatus(id);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batch status updated successfully",
            data: result,
        });
    }
);

/* =========================
   Update Batch Status Enum
========================= */
const updateBatchStatus = catchAsync(
    async (req, res) => {
        const { id } = req.params;

        const result = await BatchService.updateBatchStatus(
            id,
            req.body.status
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Batch state changed successfully",
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
    toggleBatchStatus,
    updateBatchStatus,
};