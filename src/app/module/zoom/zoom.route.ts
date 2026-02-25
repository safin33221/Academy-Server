import express, { Router } from "express";
import { ZoomController } from "./zoom.controller.js";


const router = express.Router();





// 🔹 Zoom Webhook (NO auth middleware)
router.post(
    "/zoom/webhook",
    ZoomController.handleZoomWebhook
);

export const zoomRoute: Router = router;
