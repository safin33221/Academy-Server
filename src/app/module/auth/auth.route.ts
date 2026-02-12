import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import validateRequest from "../../middleware/validateRequest.js";
import { authValidation } from "./auth.validation.js";


const router: Router = Router();

/**
 * Auth Routes
 */
router.post("/register",
    // validateRequest(authValidation.registerSchema),
    AuthController.register);



router.post("/login",
    validateRequest(authValidation.loginSchema),
    AuthController.login);


router.post("/refresh-token",
    AuthController.refreshToken);

export const AuthRoutes = router;
