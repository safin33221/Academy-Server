import { Router } from "express";
import { OtpController } from "./otp.controller.js";


const router = Router();

router.post("/send", OtpController.sendOtp);
router.post("/verify", OtpController.verifyOtp);

export const OtpRoute: Router = router;
