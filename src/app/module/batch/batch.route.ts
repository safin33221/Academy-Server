import { Router } from "express";

import auth from "../../middleware/auth.js";

import { BatchController } from "./batch.controller.js";

import { UserRole } from "@prisma/client";
import { fileUploader } from "../../helper/fileUploader.js";

const router = Router();

/* =========================
   Instructor / Admin
========================= */

// Get All Batches
router.get("/", BatchController.getAllBatches);

// Instructor Batches
router.get(
    "/instructors-batches",
    auth(UserRole.INSTRUCTOR),
    BatchController.getInstructorBatches
);

// Get Single Batch
router.get("/:id", BatchController.getSingleBatch);

// Create Batch
router.post(
    "/",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    fileUploader.upload.single("file"),
    BatchController.createBatch
);

// Update Batch
router.patch(
    "/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    fileUploader.upload.single("file"),
    BatchController.updateBatch
);

// Soft Delete
router.patch(
    "/soft-delete/:id",
    auth(UserRole.SUPER_ADMIN),
    BatchController.deleteBatch
);

// Toggle Active
router.patch(
    "/toggle/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.toggleBatchStatus
);

// Update Status
router.patch(
    "/status/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    BatchController.updateBatchStatus
);


export const BatchRoute: Router = router;