import express, { Router } from "express";
import auth from "../../middleware/auth.js";
import prismaClientPkg from "@prisma/client";
import { BatchClassController } from "./batchClass.controller.js";

const { UserRole } = prismaClientPkg;


const router = express.Router();


router.post(
    "/",
    auth(UserRole.INSTRUCTOR),
    BatchClassController.createClass
);

router.get(
    "/instructor/:id",
    auth(UserRole.INSTRUCTOR),
    BatchClassController.getInstructorClasses
);

router.get(
    "/instructor/:id",
    auth(UserRole.INSTRUCTOR),
    BatchClassController.getInstructorSingleClass
);

router.patch(
    "/:id",
    auth(UserRole.INSTRUCTOR),
    BatchClassController.updateClass
);

router.delete(
    "/:id",
    auth(UserRole.INSTRUCTOR),
    BatchClassController.deleteClass
);

router.get(
    "/student/:slug",
    auth(UserRole.STUDENT),
    BatchClassController.getStudentClasses
);

export const batchClassRoute: Router = router;
