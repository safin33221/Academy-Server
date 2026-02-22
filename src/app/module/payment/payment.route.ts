import express, { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import auth from "../../middleware/auth.js";


const router = express.Router();

router.post("/initiate", auth(), PaymentController.initiatePayment);

router.post("/success", PaymentController.paymentSuccess);
router.get("/success", PaymentController.paymentSuccess);
router.post("/fail", PaymentController.paymentFail);
router.get("/fail", PaymentController.paymentFail);
router.post("/cancel", PaymentController.paymentCancel);
router.get("/cancel", PaymentController.paymentCancel);
router.post("/ipn", PaymentController.paymentIPN);

export const PaymentRoutes: Router = router;
