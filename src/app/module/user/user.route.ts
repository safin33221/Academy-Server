import { Router } from "express";
import { UserController } from "./user.controller.js";

import {
    getAllUsersZodSchema,
    getSingleUserZodSchema,
    updateUserZodSchema,
    deleteUserZodSchema,
} from "./user.validation.js";
import validateRequest from "../../middleware/validateRequest.js";

const router: Router = Router();

/**
 * User Management Routes
 */
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
    validateRequest(updateUserZodSchema),
    UserController.updateUser
);

router.delete(
    "/:id",
    validateRequest(deleteUserZodSchema),
    UserController.deleteUser
);

export const UserRoutes = router;

