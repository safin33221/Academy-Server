import express, { Router } from "express";
import auth from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";
import { BatchClassController } from "./batchClass.controller.js";



const router = express.Router();


// 🔹 Instructor creates class
router.post(
    "/create",
    auth(UserRole.ADMIN, UserRole.INSTRUCTOR),    // role-based middleware
    BatchClassController.createClass
);


// 🔹 Student gets enrolled batch classes
router.get(
    "/my-classes",
    auth("STUDENT"),
    BatchClassController.getStudentClasses
);


export const batchClassRoute: Router = router;