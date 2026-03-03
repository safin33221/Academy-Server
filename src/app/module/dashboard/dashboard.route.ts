import { Router } from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middleware/auth.js";
import { DashboardController } from "./dashboard.controller.js";

const router = Router();

router.get(
    "/overview",
    auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTRUCTOR),
    DashboardController.getDashboardOverview
);

export const DashboardRoute: Router = router;
