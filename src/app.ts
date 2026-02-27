import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./app/middleware/globalErrorHandler.js";
import notFound from "./app/middleware/notFound.js";
import router from "./app/routes/index.js";
import cookieParser from "cookie-parser";
import { zoomRoute } from "./app/module/zoom/zoom.route.js";

const app: Application = express();

app.use(
    express.json({
        limit: "10mb",
        verify: (req, _res, buf) => {
            (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
        },
    })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/zoom", zoomRoute);
app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: "LMS API is running",
        timestamp: new Date().toISOString(),
    });
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
