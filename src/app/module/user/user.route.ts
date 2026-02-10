import { Router } from "express";
import { UserController } from "./user.controller.js";

const router: Router = Router();

/**
 * User Management Routes
 */
router.get("/", UserController.getAllUsers);
router.get("/:id", UserController.getSingleUser);
router.patch("/:id", UserController.updateUser);
router.delete("/:id", UserController.deleteUser);

export const UserRoutes = router;
