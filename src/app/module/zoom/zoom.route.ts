import express, { Router } from "express";
import prismaClientPkg from "@prisma/client";
import auth from "../../middleware/auth.js";
import { ZoomController } from "./zoom.controller.js";

const { UserRole } = prismaClientPkg;

const router = express.Router();

router.post("/webhook", ZoomController.handleZoomWebhook);

router.post(
    "/meetings",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR),
    ZoomController.createZoomMeeting
);

router.post(
    "/meetings/:meetingId/register",
    auth(
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.INSTRUCTOR,
        UserRole.STUDENT
    ),
    ZoomController.createMeetingRegistration
);

router.post(
    "/meetings/:meetingId/sync-attendance",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR),
    ZoomController.syncAttendanceAfterMeeting
);

export const zoomRoute: Router = router;
