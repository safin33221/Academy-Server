import express, { Router } from "express";
import prismaClientPkg from "@prisma/client";
import auth from "../../middleware/auth.js";
import { AttendanceController } from "./attendance.controller.js";

const { UserRole } = prismaClientPkg;

const router = express.Router();

router.get(
    "/meetings/:meetingId/attendance",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR),
    AttendanceController.getMeetingAttendance
);

router.get(
    "/classes/:classId/attendance",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR),
    AttendanceController.getBatchClassAttendance
);

router.get(
    "/classes/:classId/my-attendance",
    auth(UserRole.STUDENT),
    AttendanceController.getMyBatchClassAttendance
);

router.get(
    "/batches/:batchId/my-attendance",
    auth(UserRole.STUDENT),
    AttendanceController.getMyBatchAttendanceByBatch
);

export const attendanceRoute: Router = router;
