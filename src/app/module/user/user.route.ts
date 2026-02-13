import { Router } from "express";
import { UserController } from "./user.controller.js";

import {
    getAllUsersZodSchema,
    getSingleUserZodSchema,
    updateUserZodSchema,
    deleteUserZodSchema,
} from "./user.validation.js";
import validateRequest from "../../middleware/validateRequest.js";
import auth from "../../middleware/auth.js";

const router: Router = Router();

/**
 * User Management Routes
 */
router.get(
    "/get-me",
    auth(),
    UserController.getMe
);
router.get(
    "/",
    validateRequest(getAllUsersZodSchema),
    UserController.getAllUsers
);

router.get(
    "/:id",
    validateRequest(getSingleUserZodSchema),
    UserController.getSingleUser
);

router.patch(
    "/:id",
    // validateRequest(updateUserZodSchema),
    UserController.updateUser
);

router.patch(
    "/toggle-user-block-status/:id",
    // validateRequest(deleteUserZodSchema),
    UserController.toggleUserBlockStatus
);

export const UserRoutes = router;

