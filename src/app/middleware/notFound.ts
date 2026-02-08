import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import ApiError from "../error/ApiError.js";
import httpCode from "../utils/httpStatus.js";


const notFound = (req: Request, _res: Response, next: NextFunction) => {
    next(
        new ApiError(
            httpCode.NOT_FOUND,
            `Route not found: ${req.originalUrl}`
        )
    );
};

export default notFound;
