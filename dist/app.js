import express from "express";
import globalErrorHandler from "./app/middleware/globalErrorHandler.js";
import notFound from "./app/middleware/notFound.js";
const app = express();
/* =======================
   Global Middlewares
======================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
/* =======================
   Health Check
======================= */
app.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "LMS API is running",
        timestamp: new Date().toISOString(),
    });
});
/* =======================
   404 Handler
======================= */
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});
/* =======================
   Global Error Handler
======================= */
app.use(globalErrorHandler);
/* =======================
  Not found
======================= */
app.use(notFound);
export default app;
//# sourceMappingURL=app.js.map