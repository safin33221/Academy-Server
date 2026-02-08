import { Prisma } from "@prisma/client";
import ApiError from "../error/ApiError.js";
import httpCode from "../utils/httpStatus.js";
const globalErrorHandler = (err, _req, res, _next) => {
    let statusCode = httpCode.INTERNAL_SERVER_ERROR;
    let message = "Something went wrong";
    let errorDetails = null;
    /* =======================
       Custom API Errors
    ======================= */
    if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    /* =======================
       Prisma Known Errors
    ======================= */
    else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case "P2002":
                statusCode = httpCode.CONFLICT;
                message = "Duplicate field value";
                errorDetails = err.meta;
                break;
            case "P2003":
                statusCode = httpCode.BAD_REQUEST;
                message = "Foreign key constraint failed";
                errorDetails = err.meta;
                break;
            case "P1000":
                statusCode = httpCode.BAD_GATEWAY;
                message = "Database authentication failed";
                break;
            default:
                statusCode = httpCode.BAD_REQUEST;
                message = "Database request error";
                errorDetails = err.meta;
        }
    }
    /* =======================
       Prisma Validation Errors
    ======================= */
    else if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = httpCode.BAD_REQUEST;
        message = "Database validation error";
        errorDetails = err.message;
    }
    /* =======================
       Prisma Initialization Errors
    ======================= */
    else if (err instanceof Prisma.PrismaClientInitializationError) {
        statusCode = httpCode.INTERNAL_SERVER_ERROR;
        message = "Failed to initialize database client";
        errorDetails = err.message;
    }
    /* =======================
       Unknown Errors
    ======================= */
    else if (err instanceof Error) {
        message = err.message;
        errorDetails = err.stack;
    }
    /* =======================
       Logging (non-prod safe)
    ======================= */
    if (process.env.NODE_ENV !== "production") {
        console.error("❌ Error:", err);
    }
    /* =======================
       Response
    ======================= */
    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" && { error: errorDetails }),
    });
};
export default globalErrorHandler;
//# sourceMappingURL=globalErrorHandler.js.map