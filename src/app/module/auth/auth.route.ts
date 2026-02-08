import { Router } from "express";
import { AuthController } from "./auth.controller.js";


const router: Router = Router();

/**
 * Auth Routes
 */
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);

export const AuthRoutes = router;
