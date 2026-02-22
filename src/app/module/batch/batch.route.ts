import { Router } from "express";

import auth from "../../middleware/auth.js";
import validateRequest from "../../middleware/validateRequest.js";

import { BatchController } from "./batch.controller.js";

import { UserRole } from "@prisma/client";
import { fileUploader } from "../../helper/fileUploader.js";

const router = Router();

/* =========================
   Instructor / Admin
========================= */

// Create Batch
router.post(
    "/",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.createBatch
);

// Update Batch
router.patch(
    "/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    // validateRequest(batchValidation.updateBatchZodSchema),
    BatchController.updateBatch
);

// Delete Batch
router.delete(
    "/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.deleteBatch
);

/* =========================
   Public
========================= */

// Get All Batches (with filters)
router.get("/", BatchController.getAllBatches);

// Get Single Batch (by slug or id)
router.get("/:id", BatchController.getSingleBatch);

/* =========================
   Admin Controls
========================= */

// Activate / Deactivate Batch
router.patch(
    "/toggle/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.toggleBatchStatus
);

// Update Batch Status (UPCOMING / ONGOING etc.)
router.patch(
    "/status/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.updateBatchStatus
);

export const BatchRoute: Router = router;