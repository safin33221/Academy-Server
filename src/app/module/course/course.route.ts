
import { Router } from "express";

import auth from "../../middleware/auth.js";
import { CourseController } from "./course.controller.js";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middleware/validateRequest.js";
import { courseValidation } from "./course.validation.js";
import { fileUploader } from "../../helper/fileUploader.js";


const router = Router();

// Instructor
router.post(
    "/",
    auth(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    fileUploader.upload.single("file"),
    CourseController.createCourse
);

router.patch(
    "/:id",
    // auth(UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
    CourseController.updateCourse
);

router.patch(
    "/soft-delete/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    CourseController.deleteCourse
);

// Public
router.get("/", CourseController.getAllCourses);
router.get("/:id", CourseController.getSingleCourse);

// Admin
router.patch(
    "/approve/:id",
    auth("ADMIN", "SUPER_ADMIN"),
    CourseController.approveCourse
);

export const CourseRoute: Router = router;
