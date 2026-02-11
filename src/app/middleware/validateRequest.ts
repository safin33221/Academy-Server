import { ZodError, ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";

const validateRequest =
    (schema: ZodSchema) =>
        (req: Request, res: Response, next: NextFunction) => {
            try {
                schema.parse({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                    cookies: req.cookies,
                });

                next();
            } catch (error) {
                if (error instanceof ZodError) {
                    const errors = error.issues.map(issue => ({
                        path: issue.path.join("."),
                        message: issue.message,
                    }));

                    return res.status(httpStatus.BAD_REQUEST).json({
                        success: false,
                        message: "Validation error",
                        errors,
                    });
                }

                next(error);
            }
        };

export default validateRequest;
