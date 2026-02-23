import { Router } from "express"
import auth from "../../middleware/auth.js";
import { CourseController } from "./course.controller.js";
import { fileUploader } from "../../helper/fileUploader.js";
import { UserRole } from "@prisma/client";


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
    fileUploader.upload.single("file"),
    CourseController.updateCourse
);

router.patch(
    "/soft-delete/:id",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
    CourseController.deleteCourse
);

// Public
router.get("/my-courses", auth(UserRole.STUDENT), CourseController.MyCourses);
router.get("/:id", CourseController.getSingleCourse);
router.get("/", CourseController.getAllCourses);


// Admin
router.patch(
    "/approve/:id",
    auth("ADMIN", "SUPER_ADMIN"),
    CourseController.approveCourse
);

export const CourseRoute: Router = router;
