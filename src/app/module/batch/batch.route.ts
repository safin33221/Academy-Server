import { Router } from "express";

import auth from "../../middleware/auth.js";

import { BatchController } from "./batch.controller.js";

import prismaClientPkg from "@prisma/client";
import { fileUploader } from "../../helper/fileUploader.js";

const { UserRole } = prismaClientPkg;

const router = Router();

/* =========================
   Instructor / Admin
========================= */

// Get All Batches
router.get("/", auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR), BatchController.getAllBatches);

// public
router.get("/public", BatchController.getPublicBatches);


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



export const BatchRoute: Router = router;
